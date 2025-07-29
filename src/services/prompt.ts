
export type PromptInput = {
  name: string
  description?: string
  defaultValue?: string
  control?: 'text' | 'textarea' | 'select'
}

export const extractPromptInputs = (prompt: string): PromptInput[] => {

  // prompt inputs are defined as {{name:description:default}} in the prompt
  // description and default are optional so it could be:
  // {{name}} - just name
  // {{name:description}} - name with description
  // {{name::default}} - name with default value but no description
  // {{name:description:default}} - name with description and default value
  // use a regex with non-greedy capturing
  const regex = /{{\s*([^:}]+)(?::([^:]*?)(?::([^}]*))?)?\s*}}/g
  const inputs: PromptInput[] = []
  let match

  while ((match = regex.exec(prompt)) !== null) {
    const inputName = match[1].trim()
    const inputDescription = match[2]?.trim()
    const inputDefault = match[3]?.trim()
    
    if (!inputs.some(input => input.name === inputName)) {
      const input: PromptInput = { name: inputName }
      if (inputDescription && inputDescription.length > 0) {
        input.description = inputDescription
      }
      if (inputDefault && inputDefault.length > 0) {
        input.defaultValue = inputDefault
      }
      inputs.push(input)
    }
  }

  return inputs

}

export const replacePromptInputs = (prompt: string, inputs: Record<string, string>): string => {
  // replace inputs in the prompt with their values
  for (const [key, value] of Object.entries(inputs)) {
    prompt = prompt.replace(new RegExp(`{{\\s*${key}\\s*(?::[^:]*?)?(?::[^}]*)?\\s*}}`, 'g'), value)
  }
  return prompt
}

export const getMissingInputs = (prompt: string, inputs: Record<string, string>): PromptInput[] => {
  const promptInputs = extractPromptInputs(prompt)
  return promptInputs.filter(input => typeof inputs[input.name] === 'undefined')
}
