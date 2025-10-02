
import { Configuration } from '../types/config'
import { LlmChunkTool, LlmEngine, addUsages } from 'multi-llm-ts'
import * as dr from './deepresearch'
import Generator, { GenerationResult } from './generator'
import SearchPlugin, { SearchResultItem } from '../plugins/search'
import Message from '../models/message'
import Chat from '../models/chat'
import Runner from './runner'

type ResearchSection = {
  title: string,
  description: string,
  queries: string[]
}

class AbortError extends Error {
  name = 'AbortError'
}

export default class DeepResearchMultiStep implements dr.DeepResearch {

  config: Configuration
  workspaceId: string
  abortController: AbortController
  generators: Generator[]
  engine: LlmEngine
  model: string

  constructor(config: Configuration, workspaceId: string) {
    this.config = config
    this.workspaceId = workspaceId
    this.generators = []
  }

  stop = (): void => {
    this.abortController?.abort()
    this.generators?.forEach(generator => generator.stop())
  }

  run = async (engine: LlmEngine, chat: Chat, opts: dr.DeepResearchOpts): Promise<GenerationResult> => {

    // reset
    this.abortController = new AbortController()

    // save this
    this.engine = engine
    this.model = opts.model

    // the message we will update
    const researchTopic = chat.messages[1].content.trim()
    const response = chat.messages[chat.messages.length - 1]

    try {

      // status
      await this.generateStatusUpdate(`I am going to create a research plan for the following topic: ${researchTopic}`, response)

      // fake tool call
      const planningToolCall = {
        type: 'tool',
        id: crypto.randomUUID(),
        name: 'planning',
        status: 'Analyzing request to create a research plan',
        call: {
          params: { userQuery: researchTopic },
        },
        done: false,
      } as LlmChunkTool
      response.addToolCall(planningToolCall)
        
      // we start by running the planning agent
      const planner = new Runner(this.config, this.workspaceId, dr.planningAgent)
      const run = await planner.run('workflow', dr.planningAgent.buildPrompt(0, {
        userQuery: researchTopic,
        numSections: opts.breadth,
        numQueriesPerSection: opts.depth
      }), {
        ephemeral: true,
        ...opts
      })

      // update tool call
      const planMessage = run.messages[run.messages.length - 1]
      planningToolCall.status = 'Planning completed'
      planningToolCall.call.result = { plan: planMessage.content }
      planningToolCall.done = true
      response.addToolCall(planningToolCall)

      // update usage
      response.usage = addUsages(response.usage, planMessage.usage)

      // stopped?
      if (this.abortController?.signal.aborted) {
        throw new AbortError()
      }

      // parse
      let sections: ResearchSection[] = []

      try {
        const plan = this.parseJson(planMessage.content)
        sections = plan.sections
      } catch (e) {
        response.appendText({
          type: 'content',
          text: `This model was not able to provide a research plan in the expected format. You can try again with this model or with another model.`,
          done: true,
        })
        console.error('Error parsing research plan:', planMessage.content, e)
        return 'error'
      }

      // status
      await this.generateStatusUpdate(`The plan is completed. Proceeding with generating content for the following sections:\n${sections.map((section: ResearchSection)  => section.title).join('\n')}`, response)

      // now build each sections
      const searchResults: SearchResultItem[][] = await Promise.all(
        
        sections.map(async (section: ResearchSection) => {

          const results: SearchResultItem[] = []

          await Promise.all(
            
            section.queries.map(async (query: string) => {

              // call plugin directly
              const search = new SearchPlugin(this.config.plugins.search, this.workspaceId)

              // fake tool call
              const seachToolCall = {
                type: 'tool',
                id: crypto.randomUUID(),
                name: search.getName(),
                status: search.getRunningDescription(),
                call: {
                  params: { query: query },
                },
                done: false,
              } as LlmChunkTool
              response.addToolCall(seachToolCall)

              // execute
              let r = await search.execute({ model: opts.model }, { query: query, maxResults: this.config.deepresearch.searchResults })
              if (r.error) {
                r = await search.execute({ model: opts.model }, { query: query, maxResults: this.config.deepresearch.searchResults })
              }
              if (r.results) {
                results.push(...r.results)
              }

              // update tool call with results
              seachToolCall.status = search.getCompletedDescription('search', { query: query }, r)
              seachToolCall.call.result = r
              seachToolCall.done = true
              response.addToolCall(seachToolCall)
            })
          )

          // done
          return results

        })

      )

      // we need this for executive summary and conclusion
      const allKeyLearnings: string[] = []

      // status
      await this.generateStatusUpdate(`I have gathered information for all sections. I am going to analyze the information and generate content for each section.`, response)

      // add empty checkbox for each section
      for (const section of sections) {
        response.appendText({
          type: 'content',
          text: `\n\n- ⬜️ ${section.title}\n\n`,
          done: false,
        })
      }

      // anaylyze and generate content for each section
      const sectionsContent = await Promise.all(
        
        sections.map(async (section: ResearchSection, index: number) => {

          // now we can run the analysis agent on the results
          const analyzer = new Runner(this.config, this.workspaceId, dr.analysisAgent)
          const analysis = await analyzer.run('workflow', dr.analysisAgent.buildPrompt(0, {
            sectionObjective: section.description,
            rawInformation: searchResults[index].reduce((acc, result) => acc + `\n${result.title}\n${result.content}\n`, ''),
          }), {
            ephemeral: true,
            ...opts
          })

          // append usage
          const analysisMessage = analysis.messages[analysis.messages.length - 1]
          response.usage = addUsages(response.usage, analysisMessage.usage)

          // extract learnings
          let keyLearnings: string[] = []
          try {
            keyLearnings = this.parseJson(analysisMessage.content).learnings
          } catch (e) {
            console.error('Error parsing key learnings:', analysisMessage.content, e)
            keyLearnings = searchResults[index].map(result => `- ${result.title}: ${result.content}`)
          }

          // add to all key learnings
          allKeyLearnings.push(...keyLearnings)

          // check if are aborted
          if (this.abortController?.signal.aborted) {
            return ''
          }

          // now we can run the section agent to generate the section content
          const sectionGenerator = new Runner(this.config, this.workspaceId, dr.writerAgent)
          const sectionContent = await sectionGenerator.run('workflow', dr.writerAgent.buildPrompt(0, {
            sectionNumber: index + 1,
            sectionTitle: section.title,
            sectionObjective: section.description,
            keyLearnings: keyLearnings.join('\n')
          }), {
            ephemeral: true,
            ...opts
          })

          // append usage
          const sectionContentMessage = sectionContent.messages[sectionContent.messages.length - 1]
          response.usage = addUsages(response.usage, sectionContentMessage.usage)

          // status
          response.content = response.content.replaceAll(`\n\n- ⬜️ ${section.title}\n\n`, `\n\n- ✅ ${section.title}\n\n`)

          // done
          return sectionContentMessage.content

        })
      )

      // exec summary and conclusion
      await this.generateStatusUpdate(`Let me put the final touches`, response)

      // run agents
      const synthesis = new Runner(this.config, this.workspaceId, dr.synthesisAgent)
      const execSummary = await synthesis.run('workflow', dr.synthesisAgent.buildPrompt(0, {
        researchTopic: researchTopic,
        keyLearnings: allKeyLearnings.join('\n'),
        outputType: 'executive_summary',
      }), { ephemeral: true, ...opts })
      const conclusion = await synthesis.run('workflow', dr.synthesisAgent.buildPrompt(0, {
        researchTopic: researchTopic,
        keyLearnings: allKeyLearnings.join('\n'),
        outputType: 'conclusion',
      }), { ephemeral: true, ...opts })

      // generate title
      await this.generateStatusUpdate(`Generating title for the report`, response)
      const titleRunner = new Runner(this.config, this.workspaceId, dr.titleAgent)
      const titleResult = await titleRunner.run('workflow', dr.titleAgent.buildPrompt(0, {
        researchTopic: researchTopic,
        keyLearnings: allKeyLearnings,
      }), { ephemeral: true, ...opts })
      
      // extract title from the result
      const titleMessage = titleResult.messages[titleResult.messages.length - 1]
      let reportTitle = researchTopic // fallback title
      try {
        const titleData = this.parseJson(titleMessage.content)
        if (titleData && titleData.title) {
          reportTitle = titleData.title
        }
      } catch {
        console.warn('Failed to parse title, using research topic as fallback')
      }

      // status
      await this.generateStatusUpdate(`Done! Here is your report`, response)

      // append usages
      const execSummaryMessage = execSummary.messages[execSummary.messages.length - 1]
      const conclusionMessage = conclusion.messages[conclusion.messages.length - 1]
      response.usage = addUsages(response.usage, execSummaryMessage.usage)
      response.usage = addUsages(response.usage, conclusionMessage.usage)
      response.usage = addUsages(response.usage, titleMessage.usage)

      // executive summary
      response.appendText({
        type: 'content',
        text: `\n\n<artifact title="${reportTitle}">`,
        done: false,
      })

      // executive summary
      response.appendText({
        type: 'content',
        text: `${execSummaryMessage.content}`,
        done: false,
      })

      // each section
      for (const section of sectionsContent) {
        response.appendText({
          type: 'content',
          text: `\n\n---\n\n${section}`,
          done: false,
        })
      }

      // conclusion
      response.appendText({
        type: 'content',
        text: `\n\n---\n\n${conclusionMessage.content}`,
        done: false,
      })

      // source list deduplication
      const uniqueSearchResults: SearchResultItem[] = []
      for (const searchResult of searchResults.flat()) {
        searchResult.url = searchResult.url.split('#:~:text=')[0]
        if (!uniqueSearchResults.some(item => item.url === searchResult.url)) {
          uniqueSearchResults.push(searchResult)
        }
      }

      // sources
      response.appendText({
        type: 'content',
        text: `\n\n---\n\n### Sources:\n${uniqueSearchResults.map(item => `- [${item.title}](${item.url.replaceAll('(', '%28').replaceAll(')', '%29')})`).join('\n')}`,
        done: false,
        })

      // done
      response.appendText({
        type: 'content',
        text: '</artifact>',
        done: true,
      })

      // return success
      return 'success'

    } catch (error) {

      // if we are aborted, return stopped
      if (error.name === 'AbortError') {
        return 'stopped'
      }

      // else return error
      console.error('Error during deep research:', error)
      return 'error'


    } finally {

      response.transient = false

    }

  }

  private generateStatusUpdate = async (prompt: string, response: Message): Promise<void> => {

    const statusUpdateInstructions = `You are a status update generator, your task is to generate a status update for the user based on the following prompt.

    The larger task is to create a comprehensive research report, so the status update should reflect the progress made so far.

    The status update should be concise, informative, and provide a clear overview of the current state of the research.
    
    Examples of status updates:
    - "Let me analyze your request about quantum mechanics and create a research plan."
    - "I am done with the planning phase, I will now start gathering information for the following sections: Quantum Entanglement, Quantum Computing, and Quantum Cryptography."
    - "I have gathered information for the Quantum Entanglement section, I will now analyze it and extract key learnings."

    Notice none of those examples exceed 2 sentences and include "Status Update:" or any dumb text like that.
    `

    // check before generating
    if (this.abortController?.signal.aborted) {
      throw new AbortError()
    }

    const usage = response.usage

    const generator = new Generator(this.config) 
    this.generators.push(generator)
    await generator.generate(this.engine, [
      new Message('system', statusUpdateInstructions),
      new Message('user', prompt),
      response,
    ], { model: this.model, tools: false, })
    this.generators = this.generators.filter(g => g !== generator)

    response.usage = addUsages(usage, response.usage)

    // check before generating
    if (this.abortController?.signal.aborted) {
      throw new AbortError()
    }

    // update response
    response.transient = true
    response.appendText({
      type: 'content',
      text: '\n\n',
      done: false
    })
  }

  private parseJson = (content: string): any => {
    let idx = content.indexOf('{')
    if (idx === -1) throw new Error('No JSON object found in content')
    content = content.slice(idx)
    idx = content.lastIndexOf('}')
    if (idx === -1) throw new Error('No JSON object found in content')
    content = content.slice(0, idx + 1).trim()
    return JSON.parse(content)
  }

}
