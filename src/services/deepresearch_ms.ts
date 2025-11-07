
import { LlmChunkTool, LlmEngine, addUsages } from 'multi-llm-ts'
import Chat from '../models/chat'
import SearchPlugin, { SearchResultItem } from '../plugins/search'
import { Configuration } from '../types/config'
import AgentWorkflowExecutor from './agent_executor_workflow'
import * as dr from './deepresearch'
import { GenerationResult } from './generator'
import LlmUtils from './llm_utils'

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
  engine: LlmEngine
  model: string

  constructor(config: Configuration, workspaceId: string) {
    this.config = config
    this.workspaceId = workspaceId
  }

  run = async (engine: LlmEngine, chat: Chat, opts: dr.DeepResearchOpts): Promise<GenerationResult> => {

    // save this
    this.engine = engine
    this.model = opts.model

    // the message we will update
    const researchTopic = chat.messages[1].content.trim()
    const response = chat.messages[chat.messages.length - 1]

    try {

      // status
      const llmUtils = new LlmUtils(this.config)
      const status1 = await llmUtils.generateStatusUpdate(this.engine.getId(), this.model, `I am going to create a research plan for the following topic: ${researchTopic}`)
      response.appendText({ type: 'content', text: status1 + '\n\n', done: false })
      response.transient = true

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
      const planner = new AgentWorkflowExecutor(this.config, this.workspaceId, dr.planningAgent)
      const run = await planner.run('workflow', {
        userQuery: researchTopic,
        numSections: opts.breadth.toString(),
        numQueriesPerSection: opts.depth.toString()
      }, {
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
      if (opts.abortSignal?.aborted) {
        throw new AbortError()
      }

      // parse
      let sections: ResearchSection[] = []

      try {
        const plan = LlmUtils.parseJson(planMessage.content)
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
      const status2 = await llmUtils.generateStatusUpdate(this.engine.getId(), this.model, `The plan is completed. Proceeding with generating content for the following sections:\n${sections.map((section: ResearchSection)  => section.title).join('\n')}`)
      response.appendText({ type: 'content', text: status2 + '\n\n', done: false })
      response.transient = true

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
      const status3 = await llmUtils.generateStatusUpdate(this.engine.getId(), this.model, `I have gathered information for all sections. I am going to analyze the information and generate content for each section.`)
      response.appendText({ type: 'content', text: status3 + '\n\n', done: false })
      response.transient = true

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
          const analyzer = new AgentWorkflowExecutor(this.config, this.workspaceId, dr.analysisAgent)
          const analysis = await analyzer.run('workflow', {
            sectionObjective: section.description,
            rawInformation: searchResults[index].reduce((acc, result) => acc + `\n${result.title}\n${result.content}\n`, ''),
          }, {
            ephemeral: true,
            ...opts
          })

          // append usage
          const analysisMessage = analysis.messages[analysis.messages.length - 1]
          response.usage = addUsages(response.usage, analysisMessage.usage)

          // extract learnings
          let keyLearnings: string[] = []
          try {
            keyLearnings = LlmUtils.parseJson(analysisMessage.content).learnings
          } catch (e) {
            console.error('Error parsing key learnings:', analysisMessage.content, e)
            keyLearnings = searchResults[index].map(result => `- ${result.title}: ${result.content}`)
          }

          // add to all key learnings
          allKeyLearnings.push(...keyLearnings)

          // check if are aborted
          if (opts.abortSignal?.aborted) {
            return ''
          }

          // now we can run the section agent to generate the section content
          const sectionGenerator = new AgentWorkflowExecutor(this.config, this.workspaceId, dr.writerAgent)
          const sectionContent = await sectionGenerator.run('workflow', {
            sectionNumber: (index + 1).toString(),
            sectionTitle: section.title,
            sectionObjective: section.description,
            keyLearnings: keyLearnings.join('\n')
          }, {
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
      const status4 = await llmUtils.generateStatusUpdate(this.engine.getId(), this.model, `Let me put the final touches`)
      response.appendText({ type: 'content', text: status4 + '\n\n', done: false })
      response.transient = true

      // run agents
      const synthesis = new AgentWorkflowExecutor(this.config, this.workspaceId, dr.synthesisAgent)
      const execSummary = await synthesis.run('workflow', {
        researchTopic: researchTopic,
        keyLearnings: allKeyLearnings.join('\n'),
        outputType: 'executive_summary',
      }, { ephemeral: true, ...opts })
      const conclusion = await synthesis.run('workflow', {
        researchTopic: researchTopic,
        keyLearnings: allKeyLearnings.join('\n'),
        outputType: 'conclusion',
      }, { ephemeral: true, ...opts })

      // generate title
      const status5 = await llmUtils.generateStatusUpdate(this.engine.getId(), this.model, `Generating title for the report`)
      response.appendText({ type: 'content', text: status5 + '\n\n', done: false })
      response.transient = true
      const titleExecutor = new AgentWorkflowExecutor(this.config, this.workspaceId, dr.titleAgent)
      const titleResult = await titleExecutor.run('workflow', {
        researchTopic: researchTopic,
        keyLearnings: allKeyLearnings.join('\n'),
      }, { ephemeral: true, ...opts })
      
      // extract title from the result
      const titleMessage = titleResult.messages[titleResult.messages.length - 1]
      let reportTitle = researchTopic // fallback title
      try {
        const titleData = LlmUtils.parseJson(titleMessage.content)
        if (titleData && titleData.title) {
          reportTitle = titleData.title
        }
      } catch {
        console.warn('Failed to parse title, using research topic as fallback')
      }

      // status
      const status6 = await llmUtils.generateStatusUpdate(this.engine.getId(), this.model, `Done! Here is your report`)
      response.appendText({ type: 'content', text: status6 + '\n\n', done: false })
      response.transient = true

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

}
