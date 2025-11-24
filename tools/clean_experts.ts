
import experts from '@root/defaults/experts.json'
import { igniteEngine, Message } from 'multi-llm-ts';
import fs from 'fs'

const engine = igniteEngine('openai', { apiKey: ''});

(async () => {
  for (const expert of experts) {
    const r = await engine.complete('gpt-4o', [
      new Message('system', 'process the user input by removing any sentence like "my first request is..." or question like "what is you first command" or things like that. remove the complete sentence including any provided example. just reply with the updated text'),
      new Message('user', expert.prompt),
    ])
    expert.prompt = r.content
  }

  fs.writeFileSync('./defaults/experts.json', JSON.stringify(experts, null, 2))

})()

