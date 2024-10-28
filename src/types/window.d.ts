
import { BrowserWindowConstructorOptions } from 'electron'
interface CreateWindowOpts extends  BrowserWindowConstructorOptions {
  keepHidden?: boolean;
  queryParams?: strDict;
  hash?: string;
}
