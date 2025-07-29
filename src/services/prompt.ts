
export type PromptInput = {
  name: string
  description?: string
  control?: 'text' | 'textarea' | 'select'
}

export const extractPromptInputs = (prompt: string): PromptInput[] => {

  // prompt inputs are defined as {{name:description}} in the prompt
  // description is optional so it could be just {{name}}
  // use a regex with non-greedy capturing
  const regex = /{{\s*([^:}]+)(?::([^}]*))?\s*}}/g
  const inputs: PromptInput[] = []
  let match

  while ((match = regex.exec(prompt)) !== null) {
    const inputName = match[1].trim()
    const inputDescription = match[2]?.trim()
    if (!inputs.some(input => input.name === inputName)) {
      inputs.push({ name: inputName, description: inputDescription })
    }
  }

  return inputs

}

export const replacePromptInputs = (prompt: string, inputs: Record<string, string>): string => {
  // replace inputs in the prompt with their values
  for (const [key, value] of Object.entries(inputs)) {
    prompt = prompt.replace(new RegExp(`{{\\s*${key}\\s*(:[^}]*)?}}`, 'g'), value)
  }
  return prompt
}

export const getMissingInputs = (prompt: string, inputs: Record<string, string>): PromptInput[] => {
  const promptInputs = extractPromptInputs(prompt)
  return promptInputs.filter(input => typeof inputs[input.name] === 'undefined')
}
