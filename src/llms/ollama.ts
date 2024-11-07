
const getChatModels = [
  { id: 'llama3.2:latest', name: 'Llama 3.2' },
  { id: 'llama3.2-vision', name: 'Llama 3.2 Vision' },
  { id: 'llama3.1:latest', name: 'Llama 3.1' },
  { id: 'mistral-large:latest', name: 'Mistral Large 2' },
  { id: 'phi3.5:latest', name: 'Phi 3.5' },
  { id: 'qwen2.5:14b', name: 'Qwen 2.5' },
  { id: 'llava-llama3:latest', name: 'LLaVa Llama 3' }
]
  
const getEmbeddingModels = [
  { id: 'all-minilm', name: 'all-minilm' },
  { id: 'nomic-embed-text', name: 'nomic-embed-text' },
  { id: 'mxbai-embed-large', name: 'mxbai-embed-large' },
]

export { getChatModels, getEmbeddingModels }
