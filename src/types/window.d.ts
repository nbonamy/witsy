
import { BrowserWindowConstructorOptions } from 'electron'
export type CreateWindowOpts = BrowserWindowConstructorOptions & {
  keepHidden?: boolean;
  queryParams?: strDict;
  hash?: string;
}
