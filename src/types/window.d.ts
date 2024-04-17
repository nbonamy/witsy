
import { BrowserWindowConstructorOptions } from 'electron'
interface CreateWindowOpts extends  BrowserWindowConstructorOptions {
  queryParams?: strDict,
  hash? : string,
}
