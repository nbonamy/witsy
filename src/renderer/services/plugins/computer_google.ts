
import { ComputerAction, anyDict } from 'types/index'
import { LlmTool, MultiToolPlugin, PluginExecutionContext } from 'multi-llm-ts'
import { PluginConfig } from './plugin'

export default class extends MultiToolPlugin {

  config: PluginConfig
  workspaceId: string

  constructor(config: PluginConfig, workspaceId: string) {
    super()
    this.config = config
    this.workspaceId = workspaceId
  }

  isEnabled(): boolean {
    return true
  }

  getName(): string {
    return 'Google Computer Use'
  }

  getPreparationDescription(name: string): string {
    return `Executing ${name}…`
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  getRunningDescription(name: string, _args: anyDict): string {
    return `Running ${name}…`
  }

  getCompletedDescription(name: string, _args: anyDict, result: anyDict): string {
    if (result.error) {
      return `Error executing ${name}: ${result.error}`
    }
    return `Completed ${name}`
  }

  async getTools(): Promise<LlmTool[]> {
    // Return all 14 Google computer use actions as tools
    return [
      {
        type: 'function',
        function: {
          name: 'open_web_browser',
          description: 'Open a web browser to a URL',
          parameters: {
            type: 'object',
            properties: {
              url: { type: 'string', description: 'URL to open' }
            },
            required: ['url']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'navigate',
          description: 'Navigate to a URL in the browser',
          parameters: {
            type: 'object',
            properties: {
              url: { type: 'string', description: 'URL to navigate to' }
            },
            required: ['url']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'go_back',
          description: 'Go back in browser history',
          parameters: { type: 'object', properties: {}, required: [] }
        }
      },
      {
        type: 'function',
        function: {
          name: 'go_forward',
          description: 'Go forward in browser history',
          parameters: { type: 'object', properties: {}, required: [] }
        }
      },
      {
        type: 'function',
        function: {
          name: 'search',
          description: 'Search the web using Google',
          parameters: {
            type: 'object',
            properties: {
              query: { type: 'string', description: 'Search query' }
            },
            required: ['query']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'click_at',
          description: 'Click at specific coordinates in the browser',
          parameters: {
            type: 'object',
            properties: {
              x: { type: 'number', description: 'X coordinate (0-999)' },
              y: { type: 'number', description: 'Y coordinate (0-999)' }
            },
            required: ['x', 'y']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'hover_at',
          description: 'Hover at specific coordinates in the browser',
          parameters: {
            type: 'object',
            properties: {
              x: { type: 'number', description: 'X coordinate (0-999)' },
              y: { type: 'number', description: 'Y coordinate (0-999)' }
            },
            required: ['x', 'y']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'type_text_at',
          description: 'Click and type text at specific coordinates',
          parameters: {
            type: 'object',
            properties: {
              x: { type: 'number', description: 'X coordinate (0-999)' },
              y: { type: 'number', description: 'Y coordinate (0-999)' },
              text: { type: 'string', description: 'Text to type' }
            },
            required: ['x', 'y', 'text']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'scroll_document',
          description: 'Scroll the webpage',
          parameters: {
            type: 'object',
            properties: {
              direction: { type: 'string', description: 'Direction: up, down, left, or right' },
              amount: { type: 'number', description: 'Amount to scroll (default: 3)' }
            },
            required: ['direction']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'scroll_at',
          description: 'Scroll at specific coordinates',
          parameters: {
            type: 'object',
            properties: {
              x: { type: 'number', description: 'X coordinate (0-999)' },
              y: { type: 'number', description: 'Y coordinate (0-999)' },
              direction: { type: 'string', description: 'Scroll direction' },
              amount: { type: 'number', description: 'Amount to scroll' }
            },
            required: ['x', 'y', 'direction']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'key_combination',
          description: 'Press a keyboard key combination',
          parameters: {
            type: 'object',
            properties: {
              keys: { type: 'array', items: { type: 'string' }, description: 'Array of keys to press together' }
            },
            required: ['keys']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'drag_and_drop',
          description: 'Drag and drop from one location to another',
          parameters: {
            type: 'object',
            properties: {
              from_x: { type: 'number', description: 'Source X coordinate (0-999)' },
              from_y: { type: 'number', description: 'Source Y coordinate (0-999)' },
              to_x: { type: 'number', description: 'Target X coordinate (0-999)' },
              to_y: { type: 'number', description: 'Target Y coordinate (0-999)' }
            },
            required: ['from_x', 'from_y', 'to_x', 'to_y']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'wait_5_seconds',
          description: 'Wait for 5 seconds',
          parameters: { type: 'object', properties: {}, required: [] }
        }
      },
    ]
  }

  handlesTool(name: string): boolean {
    const googleActions = [
      'open_web_browser', 'navigate', 'go_back', 'go_forward', 'search',
      'click_at', 'hover_at', 'type_text_at', 'scroll_document', 'scroll_at',
      'key_combination', 'drag_and_drop', 'wait_5_seconds'
    ]
    return googleActions.includes(name)
  }

  async execute(_context: PluginExecutionContext, payload: anyDict): Promise<anyDict> {

    const { tool, parameters } = payload

    // Map tool name to ComputerAction
    const action = this.mapToolToAction(tool, parameters)
    if (!action) {
      return {
        url: 'about:blank',
        error: `Unknown action: ${tool}`
      }
    }

    // Execute action via browser API - returns { url, screenshot }
    const result = await window.api.computerBrowser.executeAction(action)

    // Return in Google format
    return {
      url: result.url,
      parts: [{
        inlineData: {
          mimeType: 'image/jpeg',
          data: result.screenshot
        }
      }]
    }
  }

  private mapToolToAction(tool: string, parameters: anyDict): ComputerAction | null {
    switch (tool) {
      case 'open_web_browser':
        return { action: 'open_web_browser', url: parameters.url }
      case 'navigate':
        return { action: 'navigate', url: parameters.url }
      case 'go_back':
        return { action: 'go_back' }
      case 'go_forward':
        return { action: 'go_forward' }
      case 'search':
        return { action: 'search', query: parameters.query }
      case 'click_at':
        return { action: 'click_at', coordinate: [parameters.x, parameters.y] }
      case 'hover_at':
        return { action: 'hover_at', coordinate: [parameters.x, parameters.y] }
      case 'type_text_at':
        return { action: 'type_text_at', coordinate: [parameters.x, parameters.y], text: parameters.text }
      case 'scroll_document':
        return { action: 'scroll_document', direction: parameters.direction as any, amount: parameters.amount }
      case 'scroll_at':
        return { action: 'scroll_at', coordinate: [parameters.x, parameters.y], direction: parameters.direction as any, amount: parameters.amount }
      case 'key_combination':
        return { action: 'key_combination', keys: parameters.keys }
      case 'drag_and_drop':
        return { action: 'drag_and_drop', coordinates: { from: [parameters.from_x, parameters.from_y], to: [parameters.to_x, parameters.to_y] } }
      case 'wait_5_seconds':
        return { action: 'wait_5_seconds' }
      default:
        return null
    }
  }

}
