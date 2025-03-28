
import { BrowserWindowConstructorOptions } from 'electron'
import { anyDict } from './index'
import { Application } from './automation';

export type CreateWindowOpts = BrowserWindowConstructorOptions & {
  showInDock?: boolean;
  keepHidden?: boolean;
  queryParams?: anyDict;
  hash?: string;
}

export type ReleaseFocusOpts = {
  sourceApp?: Application,
  delay?: number
}
