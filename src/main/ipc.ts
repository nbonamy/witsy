

import { History, Command, Expert } from '../types/index';
import { Configuration } from '../types/config';
import { Application, RunCommandParams } from '../types/automation';
import { McpInstallStatus, McpTool } from '../types/mcp';
import { LlmTool } from 'multi-llm-ts';

import process from 'node:process';
import fontList from 'font-list';
import { app, ipcMain, nativeImage, clipboard, dialog, nativeTheme, shell } from 'electron';
import Store from 'electron-store';
import { getCachedText } from './utils';

import AutoUpdater from './autoupdate';
import Automation, { AutomationAction } from '../automations/automation'
import Commander, { askMeAnythingId, notEditablePrompts } from '../automations/commander';
import PromptAnywhere from '../automations/anywhere';
import Transcriber from '../automations/transcriber';
import DocumentRepository from '../rag/docrepo';
import MemoryManager from './memory';
import LocalSearch from './search';
import Embedder from '../rag/embedder';
import Computer from './computer';
import Mcp from './mcp';

import * as IPC from '../ipc_consts';
import * as config from './config';
import * as history from './history';
import * as commands from './commands';
import * as experts from './experts';
import * as agents from './agents';
import * as file from './file';
import * as shortcuts from './shortcuts';
import * as window from './window';
import * as markdown from './markdown';
import * as text from './text';
import * as i18n from './i18n';
import * as debug from './network';
import * as interpreter from './interpreter';
import * as backup from './backup';

export const installIpc = (
  store: Store,
  autoUpdater: AutoUpdater,
  docRepo: DocumentRepository,
  memoryManager: MemoryManager,
  mcp: Mcp,
  installMenu: () => void,
  registerShortcuts: () => void,
  quitApp: () => void,
): void => {

  ipcMain.on(IPC.MAIN_WINDOW.SET_MODE, (event, mode) => {
    window.setMainWindowMode(mode);
    installMenu();
  });

  ipcMain.on(IPC.MAIN_WINDOW.CLOSE, () => {
    window.mainWindow.close();
  });

  ipcMain.on(IPC.APP.SHOW_ABOUT, () => {
    app.showAboutPanel();
  });

  ipcMain.on(IPC.UPDATE.CHECK, () => {
    autoUpdater.check()
  })

  ipcMain.on(IPC.UPDATE.IS_AVAILABLE, (event) => {
    event.returnValue = autoUpdater.updateAvailable;
  });

  ipcMain.on(IPC.UPDATE.APPLY, () => {
    autoUpdater.install();
  });

  ipcMain.on(IPC.APP.SET_APPEARANCE_THEME, (event, theme) => {
    nativeTheme.themeSource = theme;
    event.returnValue = theme;
  });

  ipcMain.handle(IPC.APP.SHOW_DIALOG, (event, payload): Promise<Electron.MessageBoxReturnValue> => {
    return dialog.showMessageBox(payload);
  });

  ipcMain.on(IPC.DEBUG.SHOW_CONSOLE, () => {
    window.openDebugWindow();
  })

  ipcMain.on(IPC.DEBUG.GET_NETWORK_HISTORY, (event) => {
    event.returnValue = debug.getNetworkHistory();
  })

  ipcMain.on(IPC.DEBUG.CLEAR_NETWORK_HISTORY, () => {
    debug.clearNetworkHistory();
  })

  ipcMain.on(IPC.DEBUG.OPEN_APP_FOLDER, (event, name) => {
    shell.openPath(app.getPath(name))
  })

  ipcMain.on(IPC.APP.GET_APP_PATH, (event) => {
    event.returnValue = app.getPath('userData');
  });

  ipcMain.on(IPC.APP.FONTS_LIST, async (event) => {
    event.returnValue = process.mas ? [] : await fontList.getFonts();
  });

  ipcMain.on(IPC.STORE.GET_VALUE, (event, payload) => {
    event.returnValue = store.get(payload.key, payload.fallback);
  });

  ipcMain.on(IPC.STORE.SET_VALUE, (event, payload) => {
    store.set(payload.key, payload.value);
  });

  ipcMain.on(IPC.CLIPBOARD.READ_TEXT, (event) => {
    const text = clipboard.readText();
    event.returnValue = text;
  });

  ipcMain.on(IPC.CLIPBOARD.WRITE_TEXT, async (event, payload) => {
    event.returnValue = await Automation.writeTextToClipboard(payload);
  });

  ipcMain.on(IPC.CLIPBOARD.WRITE_IMAGE, (event, payload) => {
    const image = nativeImage.createFromPath(payload.replace('file://', ''))
    clipboard.writeImage(image);
    event.returnValue = true;
  });

  ipcMain.on(IPC.CONFIG.GET_LOCALE_UI, (event) => {
    event.returnValue = i18n.getLocaleUI(app);
  });

  ipcMain.on(IPC.CONFIG.GET_LOCALE_LLM, (event) => {
    event.returnValue = i18n.getLocaleLLM(app);
  });

  ipcMain.on(IPC.CONFIG.GET_I18N_MESSAGES, (event) => {
    event.returnValue = i18n.getLocaleMessages(app);
  });

  ipcMain.on(IPC.CONFIG.LOAD, (event) => {
    event.returnValue = JSON.stringify(config.loadSettings(app));
  });

  ipcMain.on(IPC.CONFIG.SAVE, (event, payload) => {
    config.saveSettings(app, JSON.parse(payload) as Configuration);
  });

  ipcMain.on(IPC.HISTORY.LOAD, async (event) => {
    event.returnValue = JSON.stringify(await history.loadHistory(app));
  });

  ipcMain.on(IPC.HISTORY.SAVE, (event, payload) => {
    event.returnValue = history.saveHistory(app, JSON.parse(payload) as History);
  });

  ipcMain.on(IPC.COMMANDS.LOAD, (event) => {
    event.returnValue = JSON.stringify(commands.loadCommands(app));
  });

  ipcMain.on(IPC.COMMANDS.SAVE, (event, payload) => {
    event.returnValue = commands.saveCommands(app, JSON.parse(payload) as Command[]);
  });

  ipcMain.on(IPC.COMMANDS.EXPORT, (event) => {
    event.returnValue = commands.exportCommands(app);
  });

  ipcMain.on(IPC.COMMANDS.IMPORT, (event) => {
    event.returnValue = commands.importCommands(app);
  });

  ipcMain.on(IPC.COMMANDS.PICKER_CLOSE, async (_, sourceApp: Application) => {
    window.closeCommandPicker(sourceApp);
  });

  ipcMain.on(IPC.COMMANDS.ASK_ME_ANYTHING_ID, (event) => {
    event.returnValue = askMeAnythingId;
  });

  ipcMain.on(IPC.COMMANDS.IS_PROMPT_EDITABLE, (event, payload) => {
    event.returnValue = !notEditablePrompts.includes(payload);
  });

  ipcMain.on(IPC.COMMANDS.RUN, async (event, payload) => {

    // prepare
    const args: RunCommandParams = JSON.parse(payload);
    await window.closeCommandPicker(args.sourceApp);
    //await window.releaseFocus();

    // now run
    const commander = new Commander();
    await commander.execCommand(app, args);
    
  });

  ipcMain.on(IPC.EXPERTS.LOAD, (event) => {
    event.returnValue = JSON.stringify(experts.loadExperts(app));
  });

  ipcMain.on(IPC.EXPERTS.SAVE, (event, payload) => {
    event.returnValue = experts.saveExperts(app, JSON.parse(payload) as Expert[]);
  });

  ipcMain.on(IPC.EXPERTS.EXPORT, (event) => {
    event.returnValue = experts.exportExperts(app);
  });

  ipcMain.on(IPC.EXPERTS.IMPORT, (event) => {
    event.returnValue = experts.importExperts(app);
  });

  ipcMain.on(IPC.BACKUP.EXPORT, async (event) => {
    event.returnValue = await backup.exportBackup(app);
  });

  ipcMain.on(IPC.BACKUP.IMPORT, async (event) => {
    event.returnValue = await backup.importBackup(app, quitApp);
  });

  ipcMain.on(IPC.AGENTS.OPEN_FORGE,  () => {
    //window.openAgentForgeWindow();
  });

  ipcMain.on(IPC.AGENTS.LOAD, (event) => {
    event.returnValue = JSON.stringify(agents.loadAgents(app));
  });

  ipcMain.on(IPC.AGENTS.SAVE, (event, payload) => {
    event.returnValue = agents.saveAgent(app, JSON.parse(payload));
  });

  ipcMain.on(IPC.AGENTS.DELETE, (event, payload) => {
    event.returnValue = agents.deleteAgent(app, payload);
  });

  ipcMain.on(IPC.AGENTS.GET_RUNS, (event, agentId) => {
    event.returnValue = JSON.stringify(agents.getAgentRuns(app, agentId));
  });

  ipcMain.on(IPC.AGENTS.SAVE_RUN, (event, payload) => {
    event.returnValue = agents.saveAgentRun(app, JSON.parse(payload));
  });

  ipcMain.on(IPC.AGENTS.DELETE_RUN, (event, payload) => {
    const { agentId, runId } = JSON.parse(payload);
    event.returnValue = agents.deleteAgentRun(app, agentId, runId);
  });

  ipcMain.on(IPC.AGENTS.DELETE_RUNS, (event, payload) => {
    event.returnValue = agents.deleteAgentRuns(app, payload);
  });

  ipcMain.on(IPC.SETTINGS.OPEN, (event, payload) => {
    window.openSettingsWindow(payload);
  });

  ipcMain.on(IPC.APP.RUN_AT_LOGIN_GET, (event) => {
    event.returnValue = app.getLoginItemSettings();
  });

  ipcMain.on(IPC.APP.RUN_AT_LOGIN_SET, (_, value) => {
    if (app.getLoginItemSettings().openAtLogin != value) {
      app.setLoginItemSettings({
        openAtLogin: value,
        openAsHidden: true,
      });
    }
  });

  ipcMain.on(IPC.SHORTCUTS.REGISTER, () => {
    registerShortcuts();
  });

  ipcMain.on(IPC.SHORTCUTS.UNREGISTER, () => {
    shortcuts.unregisterShortcuts();
  });

  ipcMain.on(IPC.APP.FULLSCREEN, (_, payload) => {
    if (payload.window === 'main') {
      window.mainWindow.setFullScreen(payload.state);
    } else if (payload.window === 'create') {
      window.mainWindow.setFullScreen(payload.state);
    }
  });

  ipcMain.on(IPC.FILE.DELETE_FILE, (event, payload) => {
    event.returnValue = file.deleteFile(app, payload);
  });

  ipcMain.on(IPC.FILE.PICK_FILE, (event, payload) => {
    event.returnValue = file.pickFile(app, JSON.parse(payload));
  });

  ipcMain.on(IPC.FILE.PICK_DIRECTORY, (event) => {
    event.returnValue = file.pickDirectory(app);
  });

  ipcMain.on(IPC.FILE.FIND_PROGRAM, (event, payload) => {
    event.returnValue = file.findProgram(app, payload);
  });

  ipcMain.on(IPC.FILE.READ_FILE, (event, payload) => {
    event.returnValue = file.getFileContents(app, payload);
  });

  ipcMain.on(IPC.FILE.READ_ICON, async (event, payload) => {
    event.returnValue = await file.getIconContents(app, payload);
  });

  ipcMain.on(IPC.FILE.SAVE_FILE, (event, payload) => {
    event.returnValue = file.writeFileContents(app, JSON.parse(payload));
  });

  ipcMain.on(IPC.FILE.DOWNLOAD, async (event, payload) => {
    event.returnValue = await file.downloadFile(app, JSON.parse(payload));
  });

  ipcMain.on(IPC.FILE.GET_TEXT_CONTENT, async (event, contents, format) => {
    event.returnValue = await text.getTextContent(contents, format);
  });

  ipcMain.on(IPC.FILE.GET_APP_INFO, async (event, payload) => {
    event.returnValue = await file.getAppInfo(app, payload);
  });

  ipcMain.on(IPC.FILE.LIST_DIRECTORY, (event, dirPath, includeHidden) => {
    try {
      event.returnValue = {
        success: true,
        items: file.listDirectory(app, dirPath, includeHidden)
      }
    } catch (error) {
      console.error('Error while listing directory', error);
      event.returnValue = {
        success: false,
        error: error.message
      }
    }
  });

  ipcMain.on(IPC.FILE.FILE_EXISTS, (event, filePath) => {
    event.returnValue = file.fileExists(app, filePath);
  });

  ipcMain.on(IPC.FILE.WRITE_FILE, (event, filePath, content) => {
    event.returnValue = file.writeFile(app, filePath, content);
  });

  ipcMain.on(IPC.FILE.NORMALIZE_PATH, (event, filePath) => {
    event.returnValue = file.normalizePath(app, filePath);
  });

  ipcMain.on(IPC.MARKDOWN.RENDER, (event, payload) => {
    event.returnValue = markdown.renderMarkdown(payload);
  });

  ipcMain.on(IPC.INTERPRETER.PYTHON_RUN, async (event, payload) => {
    try {
      const result = await interpreter.runPython(payload);
      event.returnValue = {
        result: result
      }
    } catch (error) {
      console.log('Error while running python', error);
      event.returnValue = {
        error: error || 'Unknown error'
      }
    }
  })

  ipcMain.on(IPC.AUTOMATION.GET_TEXT, (event, payload) => {
    event.returnValue = getCachedText(payload);
  })

  ipcMain.on(IPC.AUTOMATION.INSERT, async (event, payload) => {
    const { text, sourceApp } = payload
    event.returnValue = await Automation.automate(text, sourceApp, AutomationAction.INSERT_BELOW);
  })

  ipcMain.on(IPC.AUTOMATION.REPLACE, async (event, payload) => {
    const { text, sourceApp } = payload
    event.returnValue = await Automation.automate(text, sourceApp, AutomationAction.REPLACE);
  })

  ipcMain.on(IPC.CHAT.OPEN, async (_, chatId) => {
    await window.openMainWindow({ queryParams: { view: 'chat', chatId: chatId } });
  })

  ipcMain.on(IPC.ANYWHERE.PROMPT, async () => {
    await PromptAnywhere.open();
  });

  ipcMain.on(IPC.ANYWHERE.CLOSE, async (_, sourceApp: Application) => {
    await PromptAnywhere.close(sourceApp);
  })

  ipcMain.on(IPC.ANYWHERE.RESIZE, async (_, payload) => {
    await window.resizePromptAnywhere(payload.deltaX, payload.deltaY);
  })

  ipcMain.on(IPC.READALOUD.CLOSE_PALETTE, async (_, sourceApp: Application) => {
    await window.releaseFocus({ sourceApp });
    await window.closeReadAloudPalette();
  });

  ipcMain.on(IPC.TRANSCRIBE.INSERT, async (_, payload) => {
    await Transcriber.insertTranscription(payload);
  });

  ipcMain.on(IPC.DOCREPO.OPEN, () => {
    window.openMainWindow({ queryParams: { view: 'docrepo' } });
  });

  ipcMain.on(IPC.DOCREPO.LIST, (event) => {
    event.returnValue = JSON.stringify(docRepo.list());
  });

  ipcMain.on(IPC.DOCREPO.CONNECT, async (event, baseId) => {
    try {
      await docRepo.connect(baseId, true);
      event.returnValue = true
    } catch (error) {
      console.error(error);
      event.returnValue = false
    }
  });

  ipcMain.on(IPC.DOCREPO.DISCONNECT, async (event) => {
    try {
      await docRepo.disconnect();
      event.returnValue = true
    } catch (error) {
      console.error(error);
      event.returnValue = false
    }
  });

  ipcMain.on(IPC.DOCREPO.CREATE, async (event, payload) => {
    try {
      const { title, embeddingEngine, embeddingModel } = payload;
      event.returnValue = await docRepo.create(title, embeddingEngine, embeddingModel);
    } catch (error) {
      console.error(error);
      event.returnValue = null
    }
  });

  ipcMain.on(IPC.DOCREPO.RENAME, async (event, payload) => {
    try {
      const { baseId, title } = payload;
      await docRepo.rename(baseId, title);
      event.returnValue = true
    } catch (error) {
      console.error(error);
      event.returnValue = false
    }
  });

  ipcMain.on(IPC.DOCREPO.DELETE, async (event, baseId) => {
    try {
      await docRepo.delete(baseId);
      event.returnValue = true
    } catch (error) {
      console.error(error);
      event.returnValue = false
    }
  });

  ipcMain.on(IPC.DOCREPO.ADD_DOCUMENT, async (_, payload) => {
    try {
      const { baseId, type, url } = payload;
      await docRepo.addDocument(baseId, type, url);
    } catch (error) {
      console.error(error);
    }
  });

  ipcMain.on(IPC.DOCREPO.REMOVE_DOCUMENT, async (event, payload) => {
    try {
      const { baseId, docId } = payload;
      console.log('docrepo-remove-document', baseId, docId);
      await docRepo.removeDocument(baseId, docId);
      event.returnValue = true
    } catch (error) {
      console.error(error);
      event.returnValue = false
    }
  });

  ipcMain.handle(IPC.DOCREPO.QUERY, async(_, payload) => {
    try {
      const { baseId, text } = payload;
      console.log('docrepo-query', baseId, text);
      const results = await docRepo.query(baseId, text);
      console.log('docrepo-query results returned = ', results.length);
      return results
    } catch (error) {
      console.error(error);
      return []
    }
  });

  ipcMain.on(IPC.DOCREPO.IS_EMBEDDING_AVAILABLE, async(event, payload) => {
    try {
      const { engine, model } = payload;
      event.returnValue = Embedder.isModelReady(app, engine, model);
    } catch (error) {
      console.error(error);
      event.returnValue = false
    }
  });

  ipcMain.on(IPC.MCP.IS_AVAILABLE, (event) => {
    event.returnValue = mcp !== null;
  });

  ipcMain.on(IPC.MCP.GET_SERVERS, (event) => {
    event.returnValue = mcp ? mcp.getServers() : [];
  });

  ipcMain.handle(IPC.MCP.EDIT_SERVER, async (_, server): Promise<boolean> => {
    return mcp ? await mcp.editServer(JSON.parse(server)) : false;
  });

  ipcMain.handle(IPC.MCP.DELETE_SERVER, async (_, uuid): Promise<boolean> => {
    return await mcp?.deleteServer(uuid) || false;
  });

  ipcMain.on(IPC.MCP.GET_INSTALL_COMMAND, (event, payload) => {
    const { registry, server } = payload;
    event.returnValue = mcp ? mcp.getInstallCommand(registry, server, '') : '';
  });

  ipcMain.handle(IPC.MCP.INSTALL_SERVER, async (_, payload): Promise<McpInstallStatus> => {
    const { registry, server, apiKey } = payload;
    return await mcp?.installServer(registry, server, apiKey) || 'error';
  });

  ipcMain.handle(IPC.MCP.RELOAD, async () => {
    await mcp?.reload();
  });

  ipcMain.on(IPC.MCP.GET_STATUS, (event): void => {
    event.returnValue = mcp ? mcp.getStatus() : null;
  });

  ipcMain.handle(IPC.MCP.GET_SERVER_TOOLS, async (_, payload): Promise<McpTool[]> => {
    return mcp ? await mcp.getServerTools(payload) : [];
  });

  ipcMain.handle(IPC.MCP.GET_TOOLS, async (): Promise<LlmTool[]> => {
    return mcp ? await mcp.getTools() : [];
  });

  ipcMain.handle(IPC.MCP.CALL_TOOL, async (_, payload) => {
    return mcp ? await mcp.callTool(payload.name, payload.parameters) : null;
  });

  ipcMain.on(IPC.MCP.ORIGINAL_TOOL_NAME, (event, payload) => {
    event.returnValue = mcp ? mcp.originalToolName(payload) : null;
  });

  ipcMain.on(IPC.SCRATCHPAD.OPEN, async (_, payload) => {
    await window.openScratchPad(payload);
  });

  ipcMain.on(IPC.COMPUTER.IS_AVAILABLE, async (event) => {
    event.returnValue = await Computer.isAvailable();
  });

  ipcMain.on(IPC.COMPUTER.GET_SCALED_SCREEN_SIZE, (event) => {
    event.returnValue = Computer.getScaledScreenSize();
  });

  ipcMain.on(IPC.COMPUTER.GET_SCREEN_NUMBER, (event) => {
    event.returnValue = Computer.getScreenNumber();
  });

  ipcMain.on(IPC.COMPUTER.GET_SCREENSHOT, async (event) => {
    event.returnValue = await Computer.takeScreenshot();
  });

  ipcMain.on(IPC.COMPUTER.EXECUTE_ACTION, async (event, payload) => {
    event.returnValue = await Computer.executeAction(payload);
  });

  ipcMain.on(IPC.COMPUTER.START, async () => {
    window.mainWindow?.minimize();
    window.openComputerStatusWindow();
  });

  ipcMain.on(IPC.COMPUTER.CLOSE, async () => {
    window.closeComputerStatusWindow();
    window.mainWindow?.restore();
  });

  ipcMain.on(IPC.COMPUTER.STOP, async () => {
    try {
      window.mainWindow?.webContents.send('computer-stop');
    } catch { /* empty */ }
  });

  ipcMain.on(IPC.COMPUTER.STATUS, async (_, payload) => {
    try {
      window.computerStatusWindow?.webContents.send('computer-status', payload);
    } catch { /* empty */ }
  });

  ipcMain.on(IPC.MEMORY.RESET, async () => {
    await memoryManager.reset();
  });

  ipcMain.on(IPC.MEMORY.HAS_FACTS, async (event) => {
    event.returnValue = await memoryManager.isNotEmpty();
  });

  ipcMain.on(IPC.MEMORY.FACTS, async (event) => {
    event.returnValue = await memoryManager.list();
  });

  ipcMain.on(IPC.MEMORY.STORE, async (event, payload) => {
    event.returnValue = await memoryManager.store(payload);
  });

  ipcMain.on(IPC.MEMORY.RETRIEVE, async (event, payload) => {
    event.returnValue = await memoryManager.query(payload);
  });

  ipcMain.on(IPC.MEMORY.DELETE, async (event, payload) => {
    event.returnValue = await memoryManager.delete(payload);
  });

  ipcMain.handle(IPC.SEARCH.QUERY, async (_, payload) => {
    const { query, num } = payload;
    const localSearch = new LocalSearch();
    const results = localSearch.search(query, num);
    return results;
  });

  ipcMain.on(IPC.STUDIO.START, () => {
    window.openDesignStudioWindow();
  })

  ipcMain.on(IPC.VOICE_MODE.START, () => {
    window.openRealtimeChatWindow();
  })

}

