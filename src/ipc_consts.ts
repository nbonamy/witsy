/**
 * Centralized IPC signal constants
 * This file contains all IPC signal values used for communication between main and renderer processes
 */

// General App Operations
export const GET_APP_PATH = 'get-app-path';
export const SET_APPEARANCE_THEME = 'set-appearance-theme';
export const SHOW_DIALOG = 'show-dialog';
export const FONTS_LIST = 'fonts-list';
export const SHOW_ABOUT = 'show-about';

// Main Window Operations
export const MAIN_WINDOW_SET_MODE = 'main-window-set-mode';
export const MAIN_WINDOW_CLOSE = 'main-window-close';

// Debug Operations
export const SHOW_DEBUG_CONSOLE = 'show-debug-console';
export const GET_NETWORK_HISTORY = 'get-network-history';
export const CLEAR_NETWORK_HISTORY = 'clear-network-history';
export const OPEN_APP_FOLDER = 'open-app-folder';

// Update Operations
export const UPDATE_CHECK = 'update-check';
export const UPDATE_IS_AVAILABLE = 'update-is-available';
export const UPDATE_APPLY = 'update-apply';

// Store Operations
export const STORE_GET_VALUE = 'store-get-value';
export const STORE_SET_VALUE = 'store-set-value';

// Run at Login Operations
export const RUN_AT_LOGIN_GET = 'run-at-login-get';
export const RUN_AT_LOGIN_SET = 'run-at-login-set';

// Fullscreen Operations
export const FULLSCREEN = 'fullscreen';

// File Operations
export const READ_FILE = 'read-file';
export const READ_ICON = 'read-icon';
export const SAVE_FILE = 'save-file';
export const PICK_FILE = 'pick-file';
export const PICK_DIRECTORY = 'pick-directory';
export const DOWNLOAD = 'download';
export const DELETE_FILE = 'delete-file';
export const FIND_PROGRAM = 'find-program';
export const GET_TEXT_CONTENT = 'get-text-content';
export const GET_APP_INFO = 'get-app-info';
export const LIST_DIRECTORY = 'list-directory';
export const FILE_EXISTS = 'file-exists';
export const WRITE_FILE = 'write-file';
export const NORMALIZE_PATH = 'normalize-path';

// Settings Operations
export const SETTINGS_OPEN = 'settings-open';

// Clipboard Operations
export const CLIPBOARD_READ_TEXT = 'clipboard-read-text';
export const CLIPBOARD_WRITE_TEXT = 'clipboard-write-text';
export const CLIPBOARD_WRITE_IMAGE = 'clipboard-write-image';

// Shortcuts Operations
export const SHORTCUTS_REGISTER = 'shortcuts-register';
export const SHORTCUTS_UNREGISTER = 'shortcuts-unregister';

// Config Operations
export const CONFIG_GET_LOCALE_UI = 'config-get-locale-ui';
export const CONFIG_GET_LOCALE_LLM = 'config-get-locale-llm';
export const CONFIG_GET_I18N_MESSAGES = 'config-get-i18n-messages';
export const CONFIG_LOAD = 'config-load';
export const CONFIG_SAVE = 'config-save';

// History Operations
export const HISTORY_LOAD = 'history-load';
export const HISTORY_SAVE = 'history-save';

// Automation Operations
export const AUTOMATION_GET_TEXT = 'automation-get-text';
export const AUTOMATION_REPLACE = 'automation-replace';
export const AUTOMATION_INSERT = 'automation-insert';

// Chat Operations
export const CHAT_OPEN = 'chat-open';

// Commands Operations
export const COMMANDS_LOAD = 'commands-load';
export const COMMANDS_SAVE = 'commands-save';
export const COMMANDS_EXPORT = 'commands-export';
export const COMMANDS_IMPORT = 'commands-import';
export const COMMANDS_ASK_ME_ANYTHING_ID = 'commands-ask-me-anything-id';
export const COMMANDS_IS_PROMPT_EDITABLE = 'commands-is-prompt-editable';
export const COMMAND_RUN = 'command-run';
export const COMMAND_PICKER_CLOSE = 'command-picker-close';

// Anywhere Operations
export const ANYWHERE_PROMPT = 'anywhere-prompt';
export const ANYWHERE_CLOSE = 'anywhere-close';
export const ANYWHERE_RESIZE = 'anywhere-resize';

// Experts Operations
export const EXPERTS_LOAD = 'experts-load';
export const EXPERTS_SAVE = 'experts-save';
export const EXPERTS_EXPORT = 'experts-export';
export const EXPERTS_IMPORT = 'experts-import';

// Agents Operations
export const AGENTS_OPEN_FORGE = 'agents-open-forge';
export const AGENTS_LOAD = 'agents-load';
export const AGENTS_SAVE = 'agents-save';
export const AGENTS_DELETE = 'agents-delete';
export const AGENTS_GET_RUNS = 'agents-get-runs';
export const AGENTS_SAVE_RUN = 'agents-save-run';
export const AGENTS_DELETE_RUN = 'agents-delete-run';
export const AGENTS_DELETE_RUNS = 'agents-delete-runs';

// DocRepo Operations
export const DOCREPO_OPEN = 'docrepo-open';
export const DOCREPO_LIST = 'docrepo-list';
export const DOCREPO_CONNECT = 'docrepo-connect';
export const DOCREPO_DISCONNECT = 'docrepo-disconnect';
export const DOCREPO_CREATE = 'docrepo-create';
export const DOCREPO_RENAME = 'docrepo-rename';
export const DOCREPO_DELETE = 'docrepo-delete';
export const DOCREPO_ADD_DOCUMENT = 'docrepo-add-document';
export const DOCREPO_REMOVE_DOCUMENT = 'docrepo-remove-document';
export const DOCREPO_QUERY = 'docrepo-query';
export const DOCREPO_IS_EMBEDDING_AVAILABLE = 'docrepo-is-embedding-available';

// Read Aloud Operations
export const READALOUD_CLOSE_PALETTE = 'readaloud-close-palette';

// Transcribe Operations
export const TRANSCRIBE_INSERT = 'transcribe-insert';

// Markdown Operations
export const MARKDOWN_RENDER = 'markdown-render';

// Interpreter Operations
export const CODE_PYTHON_RUN = 'code-python-run';

// MCP Operations
export const MCP_IS_AVAILABLE = 'mcp-is-available';
export const MCP_GET_SERVERS = 'mcp-get-servers';
export const MCP_EDIT_SERVER = 'mcp-edit-server';
export const MCP_DELETE_SERVER = 'mcp-delete-server';
export const MCP_GET_INSTALL_COMMAND = 'mcp-get-install-command';
export const MCP_INSTALL_SERVER = 'mcp-install-server';
export const MCP_RELOAD = 'mcp-reload';
export const MCP_GET_STATUS = 'mcp-get-status';
export const MCP_GET_SERVER_TOOLS = 'mcp-get-server-tools';
export const MCP_GET_TOOLS = 'mcp-get-tools';
export const MCP_CALL_TOOL = 'mcp-call-tool';
export const MCP_ORIGINAL_TOOL_NAME = 'mcp-original-tool-name';

// Scratchpad Operations
export const SCRATCHPAD_OPEN = 'scratchpad-open';

// Computer Operations
export const COMPUTER_IS_AVAILABLE = 'computer-is-available';
export const COMPUTER_GET_SCALED_SCREEN_SIZE = 'computer-get-scaled-screen-size';
export const COMPUTER_GET_SCREEN_NUMBER = 'computer-get-screen-number';
export const COMPUTER_GET_SCREENSHOT = 'computer-get-screenshot';
export const COMPUTER_EXECUTE_ACTION = 'computer-execute-action';
export const COMPUTER_STATUS = 'computer-status';
export const COMPUTER_START = 'computer-start';
export const COMPUTER_CLOSE = 'computer-close';
export const COMPUTER_STOP = 'computer-stop';

// Memory Operations
export const MEMORY_RESET = 'memory-reset';
export const MEMORY_HAS_FACTS = 'memory-has-facts';
export const MEMORY_FACTS = 'memory-facts';
export const MEMORY_STORE = 'memory-store';
export const MEMORY_RETRIEVE = 'memory-retrieve';
export const MEMORY_DELETE = 'memory-delete';

// Search Operations
export const SEARCH_QUERY = 'search-query';

// Studio Operations
export const STUDIO_START = 'studio-start';

// Voice Mode Operations
export const VOICE_MODE_START = 'voice-mode-start';

// Browser Window Notifications
export const UPDATE_AVAILABLE = 'update-available';
export const FILE_MODIFIED = 'file-modified';