
export type SearchRequest = {
  api_key: string
  query: string
  search_depth?: 'basic' | 'advanced'
  include_images?: boolean
  include_answer?: boolean
  include_raw_content?: boolean
  max_results?: number
  include_domains?: string[]
  exclude_domains?: string[]
}

export type SearchResult = {
  title: string
  url: string
  content: string
  raw_content: string
  score: string
}

export type SearchResponse = {
  answer: string
  query: string
  response_time: string
  images: string[]
  follow_up_questions: string[]
  results: SearchResult[]
}