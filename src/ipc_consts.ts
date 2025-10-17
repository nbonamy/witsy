// IPC Constants organized into logical namespaces for better organization and maintainability

export const APP = {
  GET_APP_PATH: 'get-app-path',
  GET_ASSET_PATH: 'get-asset-path',
  GET_VERSION: 'get-version',
  GET_HTTP_PORT: 'app-get-http-port',
  SET_APPEARANCE_THEME: 'set-appearance-theme',
  SHOW_ABOUT: 'show-about',
  // SHOW_DIALOG: 'show-dialog',
  FONTS_LIST: 'fonts-list',
  FULLSCREEN: 'fullscreen',
  RUN_AT_LOGIN_GET: 'run-at-login-get',
  RUN_AT_LOGIN_SET: 'run-at-login-set',
} as const;

export const MAIN_WINDOW = {
  UPDATE_MODE: 'main-window-update-mode',
  SET_CONTEXT_MENU_CONTEXT: 'main-window-set-menu-context',
  CLOSE: 'main-window-close',
  HIDE_WINDOW_BUTTONS: 'main-window-hide-buttons',
  SHOW_WINDOW_BUTTONS: 'main-window-show-buttons',
  MOVE_WINDOW: 'main-window-move',
} as const;

export const DEBUG = {
  SHOW_CONSOLE: 'show-debug-console',
  GET_NETWORK_HISTORY: 'get-network-history',
  CLEAR_NETWORK_HISTORY: 'clear-network-history',
  OPEN_APP_FOLDER: 'open-app-folder',
} as const;

export const UPDATE = {
  CHECK: 'update-check',
  IS_AVAILABLE: 'update-is-available',
  APPLY: 'update-apply',
} as const;

export const STORE = {
  GET_VALUE: 'store-get-value',
  SET_VALUE: 'store-set-value',
} as const;

export const FILE = {
  READ_FILE: 'read-file',
  READ_ICON: 'read-icon',
  SAVE_FILE: 'save-file',
  PICK_FILE: 'pick-file',
  PICK_DIRECTORY: 'pick-directory',
  DOWNLOAD: 'download',
  DELETE_FILE: 'delete-file',
  FIND_PROGRAM: 'find-program',
  GET_TEXT_CONTENT: 'get-text-content',
  GET_APP_INFO: 'get-app-info',
  LIST_DIRECTORY: 'list-directory',
  FILE_EXISTS: 'file-exists',
  WRITE_FILE: 'write-file',
  NORMALIZE_PATH: 'normalize-path',
  OPEN_IN_EXPLORER: 'open-in-explorer',
} as const;

export const CONFIG = {
  GET_LOCALE_UI: 'config-get-locale-ui',
  GET_LOCALE_LLM: 'config-get-locale-llm',
  GET_I18N_MESSAGES: 'config-get-i18n-messages',
  LOAD: 'config-load',
  SAVE: 'config-save',
} as const;

export const HISTORY = {
  LOAD: 'history-load',
  SAVE: 'history-save',
} as const;

export const COMMANDS = {
  LOAD: 'commands-load',
  SAVE: 'commands-save',
  EXPORT: 'commands-export',
  IMPORT: 'commands-import',
  ASK_ME_ANYTHING_ID: 'commands-ask-me-anything-id',
  IS_PROMPT_EDITABLE: 'commands-is-prompt-editable',
  RUN: 'command-run',
  PICKER_CLOSE: 'command-picker-close',
} as const;

export const EXPERTS = {
  LOAD: 'experts-load',
  SAVE: 'experts-save',
  EXPORT: 'experts-export',
  IMPORT: 'experts-import',
} as const;

export const AGENTS = {
  OPEN_FORGE: 'agents-open-forge',
  LOAD: 'agents-load',
  SAVE: 'agents-save',
  DELETE: 'agents-delete',
  GET_RUNS: 'agents-get-runs',
  GET_RUN: 'agents-get-run',
  SAVE_RUN: 'agents-save-run',
  DELETE_RUN: 'agents-delete-run',
  DELETE_RUNS: 'agents-delete-runs',
  GENERATE_WEBHOOK_TOKEN: 'agents-generate-webhook-token',
  GET_API_BASE_PATH: 'agents-get-api-base-path',
} as const;

export const DOCREPO = {
  OPEN: 'docrepo-open',
  LIST: 'docrepo-list',
  CONNECT: 'docrepo-connect',
  DISCONNECT: 'docrepo-disconnect',
  CREATE: 'docrepo-create',
  RENAME: 'docrepo-rename',
  DELETE: 'docrepo-delete',
  ADD_DOCUMENT: 'docrepo-add-document',
  REMOVE_DOCUMENT: 'docrepo-remove-document',
  QUERY: 'docrepo-query',
  IS_EMBEDDING_AVAILABLE: 'docrepo-is-embedding-available',
  GET_CURRENT_QUEUE_ITEM: 'docrepo-get-current-queue-item',
  IS_SOURCE_SUPPORTED: 'docrepo-is-source-supported'
} as const;

export const AUTOMATION = {
  GET_TEXT: 'automation-get-text',
  INSERT: 'automation-insert',
  REPLACE: 'automation-replace',
} as const;

export const PERMISSIONS = {
  CHECK_ACCESSIBILITY: 'permissions-check-accessibility',
  CHECK_AUTOMATION: 'permissions-check-automation',
  OPEN_ACCESSIBILITY_SETTINGS: 'permissions-open-accessibility-settings',
  OPEN_AUTOMATION_SETTINGS: 'permissions-open-automation-settings',
} as const;

export const CLIPBOARD = {
  READ_TEXT: 'clipboard-read-text',
  WRITE_TEXT: 'clipboard-write-text',
  WRITE_IMAGE: 'clipboard-write-image',
} as const;

export const SHORTCUTS = {
  REGISTER: 'shortcuts-register',
  UNREGISTER: 'shortcuts-unregister',
} as const;

export const CHAT = {
  OPEN: 'chat-open',
} as const;

export const ANYWHERE = {
  PROMPT: 'anywhere-prompt',
  CLOSE: 'anywhere-close',
  RESIZE: 'anywhere-resize',
} as const;

export const READALOUD = {
  CLOSE_PALETTE: 'readaloud-close-palette',
} as const;

export const TRANSCRIBE = {
  INSERT: 'transcribe-insert',
} as const;

export const MARKDOWN = {
  RENDER: 'markdown-render',
} as const;

export const INTERPRETER = {
  PYTHON_RUN: 'code-python-run',
} as const;

export const MCP = {
  IS_AVAILABLE: 'mcp-is-available',
  GET_SERVERS: 'mcp-get-servers',
  EDIT_SERVER: 'mcp-edit-server',
  DELETE_SERVER: 'mcp-delete-server',
  GET_INSTALL_COMMAND: 'mcp-get-install-command',
  INSTALL_SERVER: 'mcp-install-server',
  RELOAD: 'mcp-reload',
  RESTART_SERVER: 'mcp-restart-server',
  GET_STATUS: 'mcp-get-status',
  GET_ALL_SERVERS_WITH_TOOLS: 'mcp-get-all-servers-with-tools',
  GET_SERVER_TOOLS: 'mcp-get-server-tools',
  GET_LLM_TOOLS: 'mcp-get-tools',
  CALL_TOOL: 'mcp-call-tool',
  CANCEL_TOOL: 'mcp-cancel-tool',
  ORIGINAL_TOOL_NAME: 'mcp-original-tool-name',
  DETECT_OAUTH: 'mcp-detect-oauth',
  START_OAUTH_FLOW: 'mcp-start-oauth-flow',
  COMPLETE_OAUTH_FLOW: 'mcp-complete-oauth-flow',
} as const;

export const SCRATCHPAD = {
  OPEN: 'scratchpad-open',
  LIST: 'scratchpad-list',
  LOAD: 'scratchpad-load',
  SAVE: 'scratchpad-save',
  RENAME: 'scratchpad-rename',
  DELETE: 'scratchpad-delete',
  IMPORT: 'scratchpad-import',
} as const;

export const COMPUTER = {
  IS_AVAILABLE: 'computer-is-available',
  GET_SCALED_SCREEN_SIZE: 'computer-get-scaled-screen-size',
  GET_SCREEN_NUMBER: 'computer-get-screen-number',
  GET_SCREENSHOT: 'computer-get-screenshot',
  EXECUTE_ACTION: 'computer-execute-action',
  START: 'computer-start',
  CLOSE: 'computer-close',
  STOP: 'computer-stop',
  STATUS: 'computer-status',
} as const;

export const COMPUTER_BROWSER = {
  IS_AVAILABLE: 'computer-browser-is-available',
  EXECUTE_ACTION: 'computer-browser-execute-action',
  HIDE: 'computer-browser-hide',
} as const;

export const MEMORY = {
  RESET: 'memory-reset',
  HAS_FACTS: 'memory-has-facts',
  FACTS: 'memory-facts',
  STORE: 'memory-store',
  RETRIEVE: 'memory-retrieve',
  DELETE: 'memory-delete',
} as const;

export const SEARCH = {
  QUERY: 'search-query',
  TEST: 'search-test',
  CANCEL: 'search-cancel',
} as const;

export const STUDIO = {
  START: 'studio-start',
} as const;

export const VOICE_MODE = {
  START: 'voice-mode-start',
} as const;

export const SETTINGS = {
  OPEN: 'settings-open',
} as const;

export const BACKUP = {
  EXPORT: 'backup-export',
  IMPORT: 'backup-import',
} as const;

export const IMPORT = {
  OPENAI: 'import-openai',
} as const;

export const OLLAMA = {
  DOWNLOAD_START: 'ollama-download-start',
  DOWNLOAD_PROGRESS: 'ollama-download-progress',
  DOWNLOAD_COMPLETE: 'ollama-download-complete',
  DOWNLOAD_ERROR: 'ollama-download-error',
  DOWNLOAD_CANCEL: 'ollama-download-cancel',
} as const;

export const GOOGLE = {
  DOWNLOAD_MEDIA: 'google-download-media',
} as const;

export const WORKSPACE = {
  LIST: 'workspace-list',
  LOAD: 'workspace-load',
  SAVE: 'workspace-save',
  DELETE: 'workspace-delete',
} as const;

export const CLI = {
  INSTALL: 'cli-install',
} as const;
