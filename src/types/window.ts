
import { BrowserWindowConstructorOptions } from 'electron'
import { anyDict } from './index'
import { Application } from './automation';

export type CreateWindowOpts = BrowserWindowConstructorOptions & {
  keepHidden?: boolean;
  queryParams?: anyDict;
  hash?: string;
}

export type ReleaseFocusOpts = {
  sourceApp?: Application,
  delay?: number
}
