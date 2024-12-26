
import { BrowserWindowConstructorOptions } from 'electron'
import { anyDict } from './index'

export type CreateWindowOpts = BrowserWindowConstructorOptions & {
  keepHidden?: boolean;
  queryParams?: anyDict;
  hash?: string;
}
