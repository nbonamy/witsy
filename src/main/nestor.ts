
import { anyDict } from 'types/index.d'
import { NestorClient } from 'nestor-client'

export default class {

  nestor: NestorClient
  
  constructor() {
    console.log('Nestor initialized')
    this.nestor = new NestorClient()
  }

  async getStatus(): Promise<anyDict> {
    try {
      return await this.nestor.status()
    } catch (error) {
      console.error(error)
      return []
    }
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
