
import { Configuration } from '../types/config'
import { LlmChunkTool, LlmEngine, addUsages } from 'multi-llm-ts'
import { AssistantCompletionOpts } from './assistant'
import * as deepresearch from './deepresearch'
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

export type DeepResearchMultiStepOpts = AssistantCompletionOpts & {
  breadth: number, // number of sections to create
  depth: number, // number of queries per section
}

export const generateStatusUpdate = async (config: Configuration, engine: LlmEngine, model: string, prompt: string, response: Message): Promise<void> => {

  const statusUpdateInstructions = `You are a status update generator, your task is to generate a status update for the user based on the following prompt.

  The larger task is to create a comprehensive research report, so the status update should reflect the progress made so far.

  The status update should be concise, informative, and provide a clear overview of the current state of the research.
  
  Examples of status updates:
  - "Let me analyze your request about quantum mechanics and create a research plan."
  - "I am done with the planning phase, I will now start gathering information for the following sections: Quantum Entanglement, Quantum Computing, and Quantum Cryptography."
  - "I have gathered information for the Quantum Entanglement section, I will now analyze it and extract key learnings."

  Notice none of those examples exceed 2 sentences and include "Status Update:" or any dumb text like that.
  `

  const usage = response.usage

  const generator = new Generator(config)
  await generator.generate(engine, [
    new Message('system', statusUpdateInstructions),
    new Message('user', prompt),
    response,
  ], { model: model, tools: false, })

  response.transient = true
  response.appendText({
    type: 'content',
    text: '\n\n',
    done: false
  })
  response.usage = addUsages(usage, response.usage)
}

export const parseJson = (content: string): any => {
  let idx = content.indexOf('{')
  if (idx === -1) throw new Error('No JSON object found in content')
  content = content.slice(idx)
  idx = content.lastIndexOf('}')
  if (idx === -1) throw new Error('No JSON object found in content')
  content = content.slice(0, idx + 1).trim()
  return JSON.parse(content)
}

export const runDeepResearchMultiStep = async (config: Configuration, engine: LlmEngine, chat: Chat, opts: DeepResearchMultiStepOpts): Promise<GenerationResult> => {

  // the message we will update
  const researchTopic = chat.messages[1].content.trim()
  const response = chat.messages[chat.messages.length - 1]

  // status
  await generateStatusUpdate(config, engine, opts.model, `I am going to create a research plan for the following topic: ${researchTopic}`, response)

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
  const planner = new Runner(config, deepresearch.planningAgent)
  const run = await planner.run('workflow', deepresearch.planningAgent.buildPrompt({
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

  // parse
  let sections: ResearchSection[] = []

  try {
    const plan = parseJson(planMessage.content)
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
  await generateStatusUpdate(config, engine, opts.model, `The plan is completed. Proceeding with generating content for the following sections:\n${sections.map((section: ResearchSection)  => section.title).join('\n')}`, response)

  // now build each sections
  const searchResults: SearchResultItem[][] = await Promise.all(
    
    sections.map(async (section: ResearchSection) => {

      const results: SearchResultItem[] = []

      await Promise.all(
        
        section.queries.map(async (query: string) => {

          // call plugin directly
          const search = new SearchPlugin(config.plugins.search)

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
          let r = await search.execute({ model: opts.model }, { query: query })
          if (r.error) {
            r = await search.execute({ model: opts.model }, { query: query })
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

  // status
  await generateStatusUpdate(config, engine, opts.model, `I have gathered information for all sections. I am going to analyze the information and generate content for each section.`, response)

  // anaylyze and generate content for each section
  const sectionsContent = await Promise.all(
    
    sections.map(async (section: ResearchSection, index: number) => {

      // now we can run the analysis agent on the results
      const analyzer = new Runner(config, deepresearch.analysisAgent)
      const analysis = await analyzer.run('workflow', deepresearch.analysisAgent.buildPrompt({
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
        keyLearnings = parseJson(analysisMessage.content).learnings
      } catch (e) {
        console.error('Error parsing key learnings:', analysisMessage.content, e)
        keyLearnings = searchResults[index].map(result => `- ${result.title}: ${result.content}`)
      }

      // now we can run the section agent to generate the section content
      const sectionGenerator = new Runner(config, deepresearch.sectionAgent)
      const sectionContent = await sectionGenerator.run('workflow', deepresearch.sectionAgent.buildPrompt({
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
      response.appendText({
        type: 'content',
        text: `\n\n- ✅ ${section.title}\n\n`,
        done: false,
      })

      // done
      return sectionContentMessage.content

    })
  )

  // exec summary and conclusion
  await generateStatusUpdate(config, engine, opts.model, `Let me put the final touches`, response)
  const synthesis = new Runner(config, deepresearch.synthesisAgent)
  const execSummary = await synthesis.run('workflow', `Synthesize research findings into a comprehensive executive summary:
    - Section Contents: ${sectionsContent.join('\n')}`, { ephemeral: true, ...opts })
  const conclusion = await synthesis.run('workflow', `Synthesize research findings into a comprehensive conclusion:
  - Section Contents: ${sectionsContent.join('\n')}`, { ephemeral: true, ...opts })

  // status
  await generateStatusUpdate(config, engine, opts.model, `Done! Here is your report`, response)

  // append usages
  const execSummaryMessage = execSummary.messages[execSummary.messages.length - 1]
  const conclusionMessage = conclusion.messages[conclusion.messages.length - 1]
  response.usage = addUsages(response.usage, execSummaryMessage.usage)
  response.usage = addUsages(response.usage, conclusionMessage.usage)

  // executive summary
  response.appendText({
    type: 'content',
    text: `\n\n---\n\n${execSummaryMessage.content}`,
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
    text: '',
    done: true,
  })

  // return success
  return 'success'

}
