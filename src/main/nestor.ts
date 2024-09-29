
import { anyDict } from 'types'
import { NestorClient } from 'nestor-client'

export default class {

  nestor: NestorClient
  
  constructor() {
    console.log('Nestor initialized')
    this.nestor = new NestorClient()
  }

  async getTools(): Promise<anyDict|Array<anyDict>> {
    try {
      return await this.nestor.list()
    } catch (error) {
      console.error(error)
      return []
    }
  }

  async callTool(name: string, parameters: anyDict): Promise<any> {
    try {
      return await this.nestor.call(name, parameters)
    } catch (error) {
      console.error(error)
      return { error: error.message }
    }
  }

}
