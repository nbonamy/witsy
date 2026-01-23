#!/usr/bin/env npx ts-node

import * as fs from 'fs'
import * as path from 'path'

const AGENT_DIR = path.join(
  process.env.HOME || '',
  'Library/Application Support/Witsy/workspaces/00000000-0000-0000-0000-000000000000/agents/af908760-850f-4c84-9e6a-287cac5fe4fd'
)

const STATUSES = ['running', 'success', 'canceled', 'error'] as const
const TRIGGERS = ['manual', 'schedule', 'webhook', 'workflow'] as const
const ENGINES = ['anthropic', 'openai', 'google', 'mistral', 'xai']
const MODELS = {
  anthropic: ['claude-sonnet-4-20250514', 'claude-haiku-4-5-20251001', 'claude-opus-4-20250514'],
  openai: ['gpt-4o', 'gpt-4o-mini', 'o1-preview'],
  google: ['gemini-2.0-flash', 'gemini-2.0-pro'],
  mistral: ['mistral-large', 'mistral-medium'],
  xai: ['grok-2', 'grok-beta']
}

const PROMPTS = [
  'Write a poem about the ocean',
  'Analyze sales data for Q4',
  'Generate a marketing report',
  'Summarize the latest news',
  'Create a project timeline',
  'Review code for security issues',
  'Draft an email to the team',
  'Research competitor products',
  'Generate test data for the database',
  'Create a presentation outline',
  'Translate document to French',
  'Optimize the search algorithm',
  'Design a new user interface',
  'Build a financial forecast model',
  'Write API documentation',
  'Analyze customer feedback',
  'Create onboarding materials',
  'Generate weekly status report',
  'Plan sprint backlog items',
  'Audit system permissions'
]

const ERRORS = [
  'Connection timeout after 30000ms',
  'Rate limit exceeded. Please try again later.',
  'Invalid API key provided',
  'Model not available in your region',
  'Context length exceeded (max 128000 tokens)',
  'Service temporarily unavailable',
  'Failed to parse response from server',
  'Authentication failed: Token expired'
]

const AGENT_STEPS = [
  [{ description: 'Research' }, { description: 'Analysis' }, { description: 'Report' }],
  [{ description: 'Data Collection' }, { description: 'Processing' }],
  [{ description: 'Initialize' }, { description: 'Execute' }, { description: 'Validate' }, { description: 'Complete' }],
  [{ description: 'Fetch Data' }],
  [{ description: 'Step 1' }, { description: 'Step 2' }, { description: 'Step 3' }, { description: 'Step 4' }, { description: 'Step 5' }]
]

function randomUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0
    const v = c === 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}

function randomChoice<T>(arr: readonly T[] | T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function generateMessage(role: string, content: string, engine?: string, model?: string, toolCalls?: any[], reasoning?: string) {
  const msg: any = {
    role,
    content,
    reasoning: reasoning || null,
    attachments: [],
    toolCalls: toolCalls || [],
    uuid: randomUUID(),
    type: 'text',
    uiOnly: false,
    execMode: 'prompt',
    createdAt: Date.now() + randomInt(0, 10000),
    engine: engine || null,
    model: model || null,
    transient: false,
    edited: false
  }

  if (role === 'assistant' && engine) {
    msg.usage = {
      prompt_tokens: randomInt(100, 2000),
      completion_tokens: randomInt(50, 1500)
    }
  }

  return msg
}

function generateToolCall(name: string, args: object) {
  return {
    id: `tc-${randomUUID().slice(0, 8)}`,
    type: 'function',
    function: {
      name,
      arguments: JSON.stringify(args)
    }
  }
}

function generateShortConversation(engine: string, model: string, prompt: string) {
  const messages = [
    generateMessage('system', 'You are a helpful AI assistant.'),
    generateMessage('user', prompt, engine, model),
    generateMessage('assistant', `Here is my response to: "${prompt}"\n\nThis is a sample response with some content that addresses your request.`, engine, model, [], 'Thinking about how to respond to this request.')
  ]
  return messages
}

function generateMediumConversation(engine: string, model: string, prompt: string) {
  const messages = [
    generateMessage('system', 'You are a helpful AI assistant with access to various tools.'),
    generateMessage('user', prompt, engine, model),
    generateMessage('assistant', 'Let me search for relevant information first.', engine, model, [
      generateToolCall('web_search', { query: prompt })
    ], 'I should gather some data before responding.'),
    generateMessage('tool', 'Search results:\n- Result 1: Relevant information found\n- Result 2: Additional data points\n- Result 3: Supporting evidence'),
    generateMessage('assistant', `Based on my research, here's what I found:\n\n## Summary\nThe analysis shows several key points related to "${prompt}".\n\n## Details\n- Point 1: Important finding\n- Point 2: Another insight\n- Point 3: Recommendation`, engine, model, [], 'Now I can provide a comprehensive response.')
  ]
  return messages
}

function generateLongConversation(engine: string, model: string, prompt: string) {
  const messages = [
    generateMessage('system', 'You are an expert research assistant with access to multiple tools including web search, file operations, and data analysis.'),
    generateMessage('user', prompt, engine, model),
    generateMessage('assistant', 'I\'ll break this down into several steps. First, let me gather initial data.', engine, model, [
      generateToolCall('web_search', { query: `${prompt} overview` })
    ], 'This is a complex request that needs multiple steps.'),
    generateMessage('tool', 'Initial search results:\n- Overview document found\n- Key statistics available\n- Recent updates identified'),
    generateMessage('assistant', 'Good start. Let me dig deeper into the specifics.', engine, model, [
      generateToolCall('web_search', { query: `${prompt} detailed analysis` })
    ], 'Need more detailed information.'),
    generateMessage('tool', 'Detailed results:\n- In-depth analysis report\n- Expert opinions collected\n- Case studies referenced'),
    generateMessage('assistant', 'Now let me check for any recent developments.', engine, model, [
      generateToolCall('web_search', { query: `${prompt} latest news 2026` })
    ], 'Should check for recent updates.'),
    generateMessage('tool', 'Recent news:\n- New developments announced last week\n- Industry trends shifting\n- Regulatory changes pending'),
    generateMessage('assistant', 'Let me also gather some quantitative data.', engine, model, [
      generateToolCall('database_query', { query: 'SELECT * FROM metrics WHERE topic = ?' })
    ], 'Quantitative data will strengthen the analysis.'),
    generateMessage('tool', 'Query results:\n| Metric | Value | Change |\n|--------|-------|--------|\n| Growth | 15.2% | +3.1% |\n| Volume | 1.2M | +12% |\n| Score | 87.5 | +5.2 |'),
    generateMessage('assistant', `Based on my comprehensive research, here's my analysis:\n\n## Executive Summary\nThis report covers "${prompt}" with data from multiple sources.\n\n## Key Findings\n1. **Growth Trends**: Positive trajectory observed\n2. **Market Analysis**: Strong indicators\n3. **Recommendations**: Strategic actions suggested\n\n## Data Analysis\nThe quantitative metrics show consistent improvement across all measured dimensions.\n\n## Conclusion\nThe analysis supports a favorable outlook with specific action items identified.`, engine, model, [], 'Compiling all the research into a comprehensive response.'),
    generateMessage('user', 'Can you add more details about the recommendations?', engine, model),
    generateMessage('assistant', 'Of course! Here are expanded recommendations:\n\n### Strategic Recommendations\n\n1. **Short-term (0-3 months)**\n   - Implement quick wins identified in the analysis\n   - Set up monitoring dashboards\n   - Train team on new processes\n\n2. **Medium-term (3-12 months)**\n   - Roll out phased improvements\n   - Measure and iterate on results\n   - Expand successful initiatives\n\n3. **Long-term (12+ months)**\n   - Scale proven strategies\n   - Invest in infrastructure\n   - Build competitive advantages\n\nWould you like me to elaborate on any specific recommendation?', engine, model, [], 'Providing more detailed recommendations as requested.')
  ]
  return messages
}

function generateVeryLongConversation(engine: string, model: string, prompt: string) {
  const messages = [
    generateMessage('system', 'You are an expert research assistant with access to multiple tools including web search, file operations, data analysis, and code execution.'),
    generateMessage('user', prompt, engine, model),
    generateMessage('assistant', 'I\'ll conduct a thorough analysis. Let me start with background research.', engine, model, [
      generateToolCall('web_search', { query: `${prompt} background overview` })
    ], 'Starting comprehensive research.'),
    generateMessage('tool', 'Background info: Historical context and foundational concepts identified.'),
    generateMessage('assistant', 'Good foundation. Now let me gather current market data.', engine, model, [
      generateToolCall('web_search', { query: `${prompt} market analysis 2026` })
    ], 'Gathering market intelligence.'),
    generateMessage('tool', 'Market data: Current trends, market size $2.5B, growth rate 15% YoY.'),
    generateMessage('assistant', 'Let me check competitor landscape.', engine, model, [
      generateToolCall('web_search', { query: `${prompt} competitors comparison` })
    ], 'Analyzing competition.'),
    generateMessage('tool', 'Competitor analysis: 5 major players identified with market share breakdown.'),
    generateMessage('assistant', 'Now I\'ll look at technical specifications.', engine, model, [
      generateToolCall('web_search', { query: `${prompt} technical requirements specs` })
    ], 'Technical deep dive.'),
    generateMessage('tool', 'Technical specs: Architecture requirements, integration points, API documentation.'),
    generateMessage('assistant', 'Let me query the database for historical performance.', engine, model, [
      generateToolCall('database_query', { query: 'SELECT * FROM performance_metrics ORDER BY date DESC LIMIT 100' })
    ], 'Fetching performance data.'),
    generateMessage('tool', 'Query results: 100 rows returned showing upward trend over 12 months.'),
    generateMessage('assistant', 'I\'ll also check customer feedback data.', engine, model, [
      generateToolCall('database_query', { query: 'SELECT sentiment, count(*) FROM feedback GROUP BY sentiment' })
    ], 'Analyzing customer sentiment.'),
    generateMessage('tool', 'Sentiment analysis: 72% positive, 18% neutral, 10% negative.'),
    generateMessage('assistant', 'Let me run a predictive model on this data.', engine, model, [
      generateToolCall('code_execution', { language: 'python', code: 'import pandas as pd; model.predict(data)' })
    ], 'Running predictive analytics.'),
    generateMessage('tool', 'Model output: Predicted growth of 23% over next quarter with 85% confidence.'),
    generateMessage('assistant', `Here's my comprehensive analysis:\n\n## Executive Summary\nComplete analysis of "${prompt}" based on multi-source research.\n\n## Market Overview\n- Market size: $2.5B\n- Growth rate: 15% YoY\n- Predicted growth: 23% next quarter\n\n## Competitive Landscape\n- 5 major competitors identified\n- Current market position: #3\n\n## Technical Assessment\n- Architecture: Microservices-based\n- Integration complexity: Medium\n\n## Customer Sentiment\n- Overall: 72% positive\n- Key concerns: Performance, pricing\n\n## Recommendations\n1. Focus on performance optimization\n2. Review pricing strategy\n3. Expand integration capabilities`, engine, model, [], 'Synthesizing all research.'),
    generateMessage('user', 'Can you provide more detail on the competitive analysis?', engine, model),
    generateMessage('assistant', 'Absolutely. Let me dig deeper into competitor strategies.', engine, model, [
      generateToolCall('web_search', { query: `${prompt} competitor strategies pricing features` })
    ], 'Deep diving into competitors.'),
    generateMessage('tool', 'Competitor deep dive: Pricing models, feature matrices, and strategic positioning for all 5 competitors.'),
    generateMessage('assistant', 'Let me also check their recent announcements.', engine, model, [
      generateToolCall('web_search', { query: `${prompt} competitor news announcements 2026` })
    ], 'Checking recent competitor moves.'),
    generateMessage('tool', 'Recent news: Competitor A launched new product, Competitor B raised funding, Competitor C expanded to Europe.'),
    generateMessage('assistant', `## Detailed Competitive Analysis\n\n### Competitor A (Market Leader - 35% share)\n- **Strengths**: Brand recognition, enterprise relationships\n- **Weaknesses**: Legacy technology, slow innovation\n- **Recent**: Launched AI-powered analytics module\n\n### Competitor B (Fast Growing - 22% share)\n- **Strengths**: Modern tech stack, aggressive pricing\n- **Weaknesses**: Limited enterprise features\n- **Recent**: $50M Series C funding\n\n### Competitor C (Established - 18% share)\n- **Strengths**: Strong integrations, reliability\n- **Weaknesses**: UI/UX dated\n- **Recent**: European expansion\n\n### Competitor D (Niche - 12% share)\n- **Strengths**: Specialized features\n- **Weaknesses**: Limited scope\n\n### Competitor E (Emerging - 8% share)\n- **Strengths**: Innovative approach\n- **Weaknesses**: Unproven at scale\n\n## Strategic Recommendations\n1. **Differentiation**: Focus on AI capabilities\n2. **Pricing**: Introduce usage-based tier\n3. **Partnerships**: Target Competitor A's dissatisfied customers`, engine, model, [], 'Providing detailed competitive breakdown.'),
    generateMessage('user', 'What about implementation timeline?', engine, model),
    generateMessage('assistant', `## Implementation Timeline\n\n### Phase 1: Foundation (Weeks 1-4)\n- Infrastructure setup\n- Team onboarding\n- Initial configuration\n\n### Phase 2: Development (Weeks 5-12)\n- Core feature implementation\n- Integration development\n- Testing framework\n\n### Phase 3: Testing (Weeks 13-16)\n- QA cycles\n- Performance testing\n- Security audit\n\n### Phase 4: Deployment (Weeks 17-20)\n- Staged rollout\n- Monitoring setup\n- Documentation\n\n### Phase 5: Optimization (Weeks 21-24)\n- Performance tuning\n- User feedback integration\n- Feature refinement\n\n**Total Duration**: 6 months\n**Key Milestones**: MVP at week 8, Beta at week 14, GA at week 20`, engine, model, [], 'Providing implementation roadmap.')
  ]
  return messages
}

function generateReport(index: number) {
  const status = STATUSES[index % STATUSES.length]
  const trigger = TRIGGERS[Math.floor(index / STATUSES.length) % TRIGGERS.length]
  const engine = randomChoice(ENGINES)
  const model = randomChoice(MODELS[engine as keyof typeof MODELS])
  const prompt = PROMPTS[index % PROMPTS.length]
  const steps = randomChoice(AGENT_STEPS)

  // Determine conversation length based on index
  const conversationLength = index % 5
  let messages
  switch (conversationLength) {
    case 0:
      messages = generateShortConversation(engine, model, prompt)
      break
    case 1:
      messages = generateMediumConversation(engine, model, prompt)
      break
    case 2:
      messages = generateLongConversation(engine, model, prompt)
      break
    case 3:
      messages = generateVeryLongConversation(engine, model, prompt)
      break
    case 4:
      messages = generateVeryLongConversation(engine, model, prompt)
      break
    default:
      messages = generateMediumConversation(engine, model, prompt)
  }

  const baseTime = Date.now() - randomInt(0, 7 * 24 * 60 * 60 * 1000) // Up to 7 days ago

  const report: any = {
    uuid: randomUUID(),
    agentId: 'af908760-850f-4c84-9e6a-287cac5fe4fd',
    agentInfo: {
      name: 'Test Agent',
      steps
    },
    createdAt: baseTime,
    updatedAt: baseTime + randomInt(1000, 300000),
    trigger,
    status,
    prompt,
    messages
  }

  if (status === 'error') {
    report.error = randomChoice(ERRORS)
  }

  return report
}

// Main execution
function main() {
  // Ensure directory exists
  if (!fs.existsSync(AGENT_DIR)) {
    fs.mkdirSync(AGENT_DIR, { recursive: true })
  }

  const numReports = 20
  console.log(`Generating ${numReports} agent run reports...`)

  for (let i = 0; i < numReports; i++) {
    const report = generateReport(i)
    const filename = `${report.uuid}.json`
    const filepath = path.join(AGENT_DIR, filename)

    fs.writeFileSync(filepath, JSON.stringify(report, null, 2))
    console.log(`Created: ${filename} (status=${report.status}, trigger=${report.trigger}, messages=${report.messages.length})`)
  }

  console.log('\nDone! Reports created in:')
  console.log(AGENT_DIR)
}

main()
