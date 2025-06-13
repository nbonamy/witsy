
import { CustomToolPlugin, MultiToolPlugin, Plugin, PluginExecutionContext } from 'multi-llm-ts'

export class Plugin1 extends Plugin {
  
  isEnabled(): boolean {
    return true
  }

  getName(): string {
    return 'plugin1'
  }

  getDescription(): string {
    return 'Plugin 1'
  }

  getRunningDescription(): string {
    return 'run1'
  }

  getParameters(): any[] {
    return []
  }

// eslint-disable-next-line @typescript-eslint/no-unused-vars
  async execute(context: PluginExecutionContext, parameters: any): Promise<any> {
    return 'result1'
  }
}

export class Plugin2 extends CustomToolPlugin {

  isEnabled(): boolean {
    return true
  }

  getName(): string {
    return 'plugin2'
  }

  getDescription(): string {
    return 'Plugin 2'
  }

  getPreparationDescription(): string {
    return 'prep2'
  }

  getRunningDescription(): string {
    return 'run2'
  }

  async getTools(): Promise<any[]> {
    return [{
      function: {
        name: 'plugin2',
        description: 'Plugin 2',
        parameters: {
          type: 'object',
          properties: {
            param1: {
              type: 'string',
              description: 'Parameter 1'
            },
            param2: {
              type: 'number',
              description: 'Parameter 2'

            }
          }
        }
      }
    }]
  }

  async execute(context: PluginExecutionContext, parameters: any): Promise<any> {
    return parameters
  }
}

export class Plugin3 extends MultiToolPlugin {

  getName(): string {
    return 'plugin3'
  }

  getDescription(): string {
    return 'Plugin 3'
  }

  async getTools(): Promise<any[]> {
    return [{
      function: {
        name: 'tool1',
        description: 'Tool 1',
        parameters: {
          type: 'object',
          properties: {
            param1: {
              type: 'string',
              description: 'Parameter 1'
            },
            param2: {
              type: 'number',
              description: 'Parameter 2'

            }
          }
        }
      }
    }, {
      function: {
        name: 'tool2',
        description: 'Tool 2',
        parameters: {
          type: 'object',
          properties: {
            param1: {
              type: 'string',
              description: 'Parameter 3'
            },
            param2: {
              type: 'number',
              description: 'Parameter 4'

            }
          }
        }
      }
    }]
  }
}
