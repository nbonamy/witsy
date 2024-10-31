
import type { SearchRequest, SearchResponse } from './index.d'

export default class  {
  
  private baseURL = 'https://api.tavily.com/';

  constructor(private apiKey: string) {}

  public async search(query: string, options?: Partial<SearchRequest>): Promise<SearchResponse> {
    const requestParams: SearchRequest = {
      api_key: this.apiKey,
      query,
      search_depth: options?.search_depth || 'basic',
      include_images: options?.include_images || false,
      include_answer: options?.include_answer || false,
      include_raw_content: options?.include_raw_content || false,
      max_results: options?.max_results || 5,
      include_domains: options?.include_domains || [],
      exclude_domains: options?.exclude_domains || [],
    };

    const response = await fetch(`${this.baseURL}search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestParams)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Error ${response.status}: ${error.message}`);
    }

    return response.json() as Promise<SearchResponse>;
  }
}
