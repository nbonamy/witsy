
import { LlmEngine } from 'multi-llm-ts'
import { GenerationResult } from './generator'
import { AssistantCompletionOpts } from './assistant'
import Agent from '../models/agent'
import Chat from '../models/chat'

export type DeepResearchOpts = AssistantCompletionOpts & {
  breadth: number, // number of sections to create
  depth: number, // number of queries per section
}

export interface DeepResearch {
  stop(): void
  run(engine: LlmEngine, chat: Chat, opts: DeepResearchOpts): Promise<GenerationResult>
}

export const planningAgent = Agent.fromJson({
  name: 'planning',
  description: 'Strategic research planner specialized in query decomposition and research methodology design. Creates comprehensive research strategies and identifies optimal information gathering approaches.',
  tools: [
    'search_internet',
    'extract_webpage_content',
  ],
  agents: [],
  //docrepo: 'research_strategies',
  instructions: `You are a planning agent, the strategic planner for deep research investigations.

Given a user research query, your goal is to identify the different sections of the final report. The number of sections will be provided by the user. You have a tolerance of plus or minus 1 section depending on how you interpret the topic and evaluate its complexity.

For each section you will provide:
- the title of the section
- a detailed description of the section's objective
- search queries that will be used to gather information for that section. The number of queries will be provided by the user, but you should aim for a minimum of 1 query per section.If you feel this section requires more queries, you can add them, up to one more query than the user requested.

Do not execute any searches or analysis, just plan the structure of the research report. The search_internet tool is made available to you to help you understand the topic and create relevant sections and search queries.

Your output will ONLY consist of the list of sections as a JSON object with no markdown formatting or additional text. The JSON object should have the following structure:

{
  "sections": [
    {
      "title": "Section Title",
      "description": "Detailed description of the section's objective",
      "queries": [
        "Search query 1",
        "Search query 2"
      ]
    },
    ...
  ]
}

  `,
  prompt: `Plan the research report structure for the following query: {{userQuery}}. Aim for {{numSections}} sections, with {{numQueriesPerSection}} search queries per section.`,
  parameters: [
    {
      name: 'userQuery',
      type: 'string',
      description: 'The original user research query',
      required: true
    },
    {
      name: 'numSections',
      type: 'integer',
      description: 'The number of sections to create for the research report',
      required: false,
      default: 3
    },
    {
      name: 'numQueriesPerSection',
      type: 'integer',
      description: 'The number of search queries to generate for each section',
      required: true,
      minimum: 1
    }
  ],
});

export const searchAgent = Agent.fromJson({
  name: 'search',
  description: 'Expert information retrieval specialist optimized for comprehensive web search and content extraction',
  tools: [
    'search_internet',
    'extract_webpage_content',
    'get_youtube_transcript'
  ],
  agents: [],
  //docrepo: 'search_results',
  instructions: `You are a search agent, responsible for executing targeted web searches and extracting relevant content.
  
Your sole responsibility is to run the search_internet tool with the provided search query and extract relevant content from the results.

Do not summarize of analyze the content, just return the raw search results and extracted content.

Remove all <tool> tags from the content and return it as plain text.`,
  prompt: `Execute targeted search for: {{searchQuery}}`,
  parameters: [
    {
      name: 'searchQuery',
      type: 'string',
      description: 'Specific search query to execute',
      required: true
    },
  ],
});

export const analysisAgent = Agent.fromJson({
  name: 'analysis',
  description: 'Advanced information processor specialized in extracting insights, identifying patterns, and synthesizing knowledge from raw research data. Performs critical analysis and fact verification.',
  tools: [
    'run_python_code',
    'extract_webpage_content'
  ],
  agents: [],
  //docrepo: 'analyzed_knowledge',
  instructions: `You are an analyst agent, responsible for processing raw research data and extracting meaningful insights.

From the content provided, your task is to identify 5 to 10 key learnings that are relevant to the section objective.

Your output will ONLY consist of the list of learnings as a JSON object with no markdown formatting or additional text. The JSON object should have the following structure:

{
  "learnings": [
    "learning 1",
    "learning 2",
    ...
    "learning n"
  ]
}
  `,
  prompt: `Analyze the following information for the section:
- Section Objective: {{sectionObjective}}
- Raw Information: {{rawInformation}}
  `,
  parameters: [
    {
      name: 'sectionObjective',
      type: 'string',
      description: 'The objective of the section being analyzed',
      required: true
    },
    {
      name: 'rawInformation',
      type: 'string',
      description: 'Information to be analyzed',
      required: true
    }
  ]
});

export const sectionAgent = Agent.fromJson({
  name: 'section',
  description: 'Section generator that creates detailed, coherent sections of research reports based on analyzed information and section objectives. Ensures each section is well-structured and contributes to the overall narrative.',
  tools: [
    'run_python_code'
  ],
  agents: [],
  //docrepo: 'research_sections',
  instructions: `You are the SectionAgent, responsible for generating detailed sections of research reports based on analyzed information and section objectives.

Your task is to ensure each section is well-structured and contributes to the overall narrative of the report.

The text generated is part of a larger research report, so do not include any introductory or concluding remarks, just the content of the section.

Start your response with the section title as a 1st level header (#) and build the section content after it. Make sure you use the section objective to guide the content you generate.

You can use markdown formatting to structure the section, such as headings, lists, and code blocks: make sure all subsequent headings are 2nd level headers (##) or lower. Do not include too many level 2 headings: 3 to 5 should be enough. Group concepts if needed so that each level 2 content is meaty enough.

Example of a section content about the collapse of the wave function in quantum mechanics:

<EXAMPLE>
# 1. Collapse of the Wave Function
The collapse of the wave function is a fundamental concept in quantum mechanics that describes how a quantum system transitions from a superposition of states to a single state upon measurement. This process is crucial for understanding the role of observation in quantum mechanics and has significant implications for the interpretation of quantum phenomena.
## What is the Collapse of the Wave Function?
Text explaining the collapse of the wave function, its significance, and how it relates to quantum mechanics.
## The Role of Observation in Quantum Mechanics
Text discussing the role of observation in quantum mechanics, how it affects the wave function, and the implications for quantum systems.
## Implications of the Collapse of the Wave Function
Text exploring the implications of the collapse of the wave function for quantum mechanics, including its impact on theories and interpretations.
Very succinct conclusion on this section
</EXAMPLE>

  `,
  prompt: `Generate a detailed section based on the following information:
Section Number: {{sectionNumber}}
Section Title: {{sectionTitle}}
Section Objective: {{sectionObjective}}
Key Learnings: {{keyLearnings}}`,
  parameters: [
    {
      name: 'sectionNumber',
      type: 'number',
      description: 'The index of the section being generated',
      required: true
    },
    {
      name: 'sectionTitle',
      type: 'string',
      description: 'The title of the section being generated',
      required: true
    },
    {
      name: 'sectionObjective',
      type: 'string',
      description: 'The objective of the section being generated',
      required: true
    },
    {
      name: 'keyLearnings',
      type: 'string',
      description: 'The key learnings that have been extracted for this section',
      required: true
    }
  ]

});

export const synthesisAgent = Agent.fromJson({
  name: 'synthesis',
  description: 'Expert report synthesizer that transforms analyzed information into comprehensive, coherent reports. Integrates findings, constructs narratives, and generates executive summaries or conclusions.',
  tools: [
    'run_python_code'
  ],
  agents: [],
  //docrepo: 'research_reports',
  instructions: `You are a synthesis agent, responsible summarizing information for executive summaries or conclusions.

Your task is to synthesize the provided section contents into a comprehensive executive summary or conclusion based on the user request: do not generate both.

When generating the executive summary, focus on the key findings and insights from the research sections, ensuring it provides a clear overview of the research conducted. Make sure it is in a TL;DR format (but do not say it is a TL;DR) so it can be easily digested: one or two paragraphs with 3 to 5 key learnings. Do not include a conclusion in the executive summary, just the key findings and insights.

When generating the conclusion, summarize the overall findings and implications of the research, providing a final perspective on the topic. Keep it also concise, but ensure it encapsulates the essence of the research and its significance.

Start your content with "# Executive Summary" or "# Conclusion" as appropriate, and then provide the content of the summary or conclusion. Don't say things like "I'll synthesize" or "I'll summarize" or "This is the executive summary" or "This is the conclusion". Just provide the content directly.
  `,
  prompt: `Synthesize research findings into a comprehensive report:

Research Topic: {{researchTopic}}
Key Learnings: {{keyLearnings}}
Output Type: {{outputType}}`,
  parameters: [
    {
      name: 'researchTopic',
      type: 'string',
      description: 'The topic of the research',
      required: true
    },
    {
      name: 'keyLearnings',
      type: 'string',
      description: 'The key learnings that have been extracted from the analysis',
      required: true
    },
    {
      name: 'outputType',
      type: 'string',
      description: 'The format of the output desired',
      enum: ['executive summary', 'conclusion'],
      required: true
    }
  ]
});

export const deepResearchAgents = [
  planningAgent,
  searchAgent,
  analysisAgent,
  sectionAgent,
  synthesisAgent,
]
