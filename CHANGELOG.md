# Changelog

All notable changes to this project will be documented in this file.

## [3.5.2] - WIP

### Added
- Search text inside chat (Cmd+F/Ctrl+F)
- Navigation inside the chat during searches (https://github.com/nbonamy/witsy/issues/531)
- Support new Grok Image/Video generation capabilities (https://github.com/nbonamy/witsy/issues/537)

### Changed
- N/A

### Fixed
- Text pasted as image fix
- Crash when attaching large files (256MB arbitrary limit)

### Removed
- N/A


## [3.5.1] - 2026-02-21

### Added
- Google Base URL
- Support LM Studio authentication (https://github.com/nbonamy/witsy/issues/525)
- Show conversations date time creation (https://github.com/nbonamy/witsy/issues/522)
- "Scan for Changes" button for Knowledge Base (https://github.com/nbonamy/witsy/issues/524)
- Per-server default MCP timeout overrides (https://github.com/nbonamy/witsy/issues/523)

### Changed
- Performance optimization for message rendering during streaming
- MCP collision rework (optimistic strategy vs previous pessimistic strategy)

### Fixed
- Bug fixes for markdown tag closing in streamed messages
- User messages with fenced code blocks render incorrectly in chat history (https://github.com/nbonamy/witsy/issues/526)
- Design Studio Ollama model not showing (https://github.com/nbonamy/witsy/issues/527)
- Model change in the right sidebar clears system prompt (https://github.com/nbonamy/witsy/issues/528)
- Personal Data Saving/Memories Seems Broken (https://github.com/nbonamy/witsy/issues/517)

### Removed
- N/A


## [3.5.0] - 2026-01-29

### Added
- Ability to Exclude Folders from RAG (https://github.com/nbonamy/witsy/issues/515)
- Ollama image generation support (https://github.com/nbonamy/witsy/issues/521)
- Stop agent execution buttons

### Changed
- New agent view with step-by-step execution
- Improved arrow key history navigation in prompt (only triggers at start/end of text)

### Fixed
- Various memory leaks fixes
- Context preservation on tool calls
- YouTube plugin fix (https://github.com/nbonamy/witsy/issues/516)

### Removed
- N/A


## [3.4.2] - 2026-01-22

### Added
- More Quick dictation options and keyboard shortcuts
- CLI port persistence (saves port when using -p or /port command)
- macOS permission options in Settings Advanced
- Request cooldown time per provider (https://github.com/nbonamy/witsy/issues/514)
- Parallel chats support
- Agent Forge card view with table/card toggle

### Changed
- N/A

### Fixed
- Quick dictation CPU usage

### Removed
- N/A


## [3.4.0] - 2026-01-11

### Added
- Parakeet WebGPU support
- Apple SpeechAnalyzer support (macOS 26+ required)
- New quick dictation window (Speech-to-text renamed to Audio Booth)
- Re-authenticate link in MCP server editor
- Favicon display for HTTP/SSE MCP servers
- Google Gemini Live support in Voice Chat

### Changed
- Voice Settings panels overhaul
- Voice Chat tool access and transcript

### Fixed
- N/A

### Removed
- N/A


## [3.3.2] - 2025-01-08

### Added
- CLI filesystem access and tool display fixes
- Parakeet STT local model support (https://github.com/nbonamy/witsy/issues/471)
- New quick dictation window (Speech-to-text renamed to Audio Booth)
- SearXNG support

### Changed
- Agent runs now capture agent info (name, step descriptions) for standalone display
- Ability to search multiple knowledge bases
- Knowledge base access from expert

### Fixed
- Expert output format ignored when Knowledge Base attached
- Fileystem access for scheduled agents

### Removed
- N/A


## [3.3.1] - 2025-12-27

### Added
- Add priority selection option for OpenAI (https://github.com/nbonamy/witsy/issues/508)
- Multi-line input support - allow typing Enter when writing a prompt (https://github.com/nbonamy/witsy/issues/510)
- Cloudflare AI Gateway observability (https://github.com/nbonamy/witsy/issues/511)
- Status of Knowledge Base Updates (https://github.com/nbonamy/witsy/issues/512)

### Changed
- Ability to Submit Large Files Manually (https://github.com/nbonamy/witsy/issues/497)

### Fixed
- Gemini Models don't receive any images (https://github.com/nbonamy/witsy/issues/503)
- Automator.pasteText restores clipboard before paste completes (https://github.com/nbonamy/witsy/issues/505)
- Path traversal in filesystem plugin bypasses allowedPaths(https://github.com/nbonamy/witsy/issues/506)
- Fix Soniox streaming buffer (https://github.com/nbonamy/witsy/pull/507)
- Search text highlighting adds equal signs to text formatted as code (https://github.com/nbonamy/witsy/issues/509)

### Removed
- N/A


## [3.3.0] - 2025-12-11

### Added
- [Google] Support for Gemini 3 Preview (thoughtSignature)
- [Openrouter] Support for reasoning models
- [Google] Support for Nano Banana Pro
- Favorites management (https://github.com/nbonamy/witsy/issues/499)
- Facet navigation toolbar

### Changed
- N/A

### Fixed
- [Google] Multi tool calling
- [Anthropic] Multi tool calling
- [Deepseek] Function calling with Deepseek-Reasoner
- [Mistral] Reasoning tokens
- Favorites should be available anywhere a model can be selected (https://github.com/nbonamy/witsy/issues/498)

### Removed
- N/A


## [3.2.3] - 2015-12-07

### Added
- Add Support for Advanced Model Parameters like 'Thinking Mode' for Ollama model (https://github.com/nbonamy/witsy/issues/491)

### Changed
- Allow uploading raw text files (https://github.com/nbonamy/witsy/issues/494)
- New Excel data extractor

### Fixed
- N/A

### Removed
- N/A


## [3.2.2] - 2025-11-27

### Added
- N/A

### Changed
- N/A

### Fixed
- [Bug] v3.2.1 SyntaxError causes input/send functionality to fail completely on Windows 11 (https://github.com/nbonamy/witsy/issues/493)
- Unable to have a normal conversation (https://github.com/nbonamy/witsy/issues/492)

### Removed
- N/A


## [3.2.1] - 2025-11-24

### Added
- Scratchpad action on assistant messages

### Changed
- Agent import tries MCP tool remapping
- HTTP server listens on localhost only

### Fixed
- Agent refresh issues
- Design Studio Drawing Canvas icons
- Large documents embedding fixes

### Removed
- N/A


## [3.2.0] - 2025-11-12

### Added
- Edit messages, quote user message (https://github.com/nbonamy/witsy/issues/479)
- LocalAI image models not listed in Design Studio (https://github.com/nbonamy/witsy/issues/482)
- Conversation usage reporting
- Show RAG search results
- MCP Tool tester

### Changed
- Agent: can use user variables at all steps
- Local search: optimizations and captcha handling

### Fixed
- Webapp persistance storage fix
- Import Markdown failing in Release
- Message refresh bug when streaming
- Commands menu disappeared (https://github.com/nbonamy/witsy/issues/486)

### Removed
- N/A


## [3.1.1] - 2025-11-06

### Added
- Easy QoL: right-click context menu to copy/paste in messages chat field (https://github.com/nbonamy/witsy/issues/480)

### Changed
- N/A

### Fixed
- Cannot Add New Experts (https://github.com/nbonamy/witsy/issues/477)
- Minimax implementation fix (https://github.com/nbonamy/witsy/issues/478)

### Removed
- N/A


## [3.1.0] - 2025-11-02

### Added
- Experts categories
- Sandboxed python runtime
- Duplicate agent
- Experts attached to agent step
- Import Markdown back into conversations (https://github.com/nbonamy/witsy/issues/469)
- MiniMax Text-to-Speech API (https://github.com/nbonamy/witsy/issues/461)

### Changed
- Wider engine/model menu (https://github.com/nbonamy/witsy/issues/463)
- Download button for text mangles python export (https://github.com/nbonamy/witsy/issues/468)
- Update to Soniox v3 endpoint (https://github.com/nbonamy/witsy/pull/457)
- Filesystem plugin rewrite
- More LLM provider error reporting
- Menu refactor

### Fixed
- Chat color with dark mode (https://github.com/nbonamy/witsy/issues/464)
- Ollama Chain of Thought / Reasoning in Prompt (https://github.com/nbonamy/witsy/issues/467)
- Knowledge Base is not shown / can´t be chosen in some languages (https://github.com/nbonamy/witsy/issues/474)
- Tool calls not showing on main chat when not streaming (https://github.com/nbonamy/witsy/issues/451)
- Trailing underscore sometimes appearing on messages

### Removed
- N/A


## [3.0.4] - 2025-10-24

### Added
- Knowledge plugin to automatically connect knowledge base connections (https://github.com/nbonamy/witsy/issues/450)
- Set folder default settings dialog (https://github.com/nbonamy/witsy/issues/454)
- Better error reporting for OpenRouter failures (https://github.com/nbonamy/witsy/issues/458)

### Changed
- N/A

### Fixed
- Prompt menu not showing in some languages (https://github.com/nbonamy/witsy/issues/455)
- Bug: Play/Pause and stop button for read aloud is gone (https://github.com/nbonamy/witsy/issues/459)
- Cannot use Mistral model (https://github.com/nbonamy/witsy/issues/456)

### Removed
- N/A


## [3.0.3] - 2025-10-18

### Added
- Auth for MCP SSE servers (https://github.com/nbonamy/witsy/issues/442)
- Custom OpenAI-compatible TTS Endpoints (https://github.com/nbonamy/witsy/issues/449)

### Changed
- Agent run view redesign
- Update to new Fireworks Realtime (https://github.com/nbonamy/witsy/issues/446)

### Fixed
- MCP List Doesn't Scroll when number of servers exceeds page length (https://github.com/nbonamy/witsy/issues/448)
- Agent Forge not working (https://github.com/nbonamy/witsy/issues/452)
- Whisper STT error message

### Removed
- N/A


## [3.0.2] - 2025-10-14

### Added
- Improved chat and agent abort capability
- Helpful message when search fails
- Groq and Cerebras reasoning

### Changed
- Major refactoring of agent system (executor, runner, a2a communication)
- New DeepResearch execution model
- Context Menu position calculation

### Fixed
- N/A

### Removed
- N/A


## [3.0.0] - 2025-10-07

### Added
- Design Studio drawing
- Let users choose which tools to enable from each MCP, and persist that choice for all models (https://github.com/nbonamy/witsy/issues/410)
- Allow selecting and copying text from tool execution results (https://github.com/nbonamy/witsy/issues/421)
- Support Perplexity Search API (https://github.com/nbonamy/witsy/issues/427)
- Web 'Apps' (https://github.com/nbonamy/witsy/issues/431)
- Clear all shortcuts button (https://github.com/nbonamy/witsy/pull/405)
- add shell.nix (https://github.com/nbonamy/witsy/pull/424)
- OpenAI: Hide models with explicit release dates
- Table rendering as artifact, download as CSV and XSLX
- HTTP Server to control Witsy (see README.md)
- Agent trigger via webhooks (see README.md)
- Command line version of Witsy (see README.md)
- OpenAI Sora video generation

### Changed
- New UI

### Fixed
- Incorrect token usage count for Gemini 2.5 Pro (https://github.com/nbonamy/witsy/issues/391)
- White screen + Delay (https://github.com/nbonamy/witsy/issues/411)
- When using the fork command, the title field is not filled (https://github.com/nbonamy/witsy/issues/409)
- Using Tool websearch doesn´t work anymore (https://github.com/nbonamy/witsy/issues/428)
- For Ollama 'Max Completion Tokens' should allow negative values (https://github.com/nbonamy/witsy/issues/413)
- Added keep-alive on ollama embeddings (https://github.com/nbonamy/witsy/issues/425)
- Scopes from OAuth protected resource metadata should be used for DCR (https://github.com/nbonamy/witsy/issues/420)
- Window freezing (when streaming is enabled) when response text is long (https://github.com/nbonamy/witsy/issues/426)
- API Key label displayed with Google selected in Video plugin settings
- Smithery Arg Parsing - Runtime & Install (https://github.com/nbonamy/witsy/issues/435)
- Better MCP Logs (https://github.com/nbonamy/witsy/issues/436)

### Removed
- N/A


## [2.14.0] - 2025-08-31

### Added
- HTML Artifacts preview
- Artifacts download formats (text, markdown, html, pdf)
- Add Deep Research title generation feature
- Nano Banana Support

### Changed
- Support for secure api storage (https://github.com/nbonamy/witsy/issues/407)

### Fixed
- Design Studio: regional parameter error (personGeneration.allow_all) (https://github.com/nbonamy/witsy/issues/404)
- Google Models deduplication (trying to work around https://github.com/googleapis/js-genai/issues/803)

### Removed
- N/A


## [2.13.2] - 2025-08-22

### Added
- Add Support for Anthropic's 'thinking.budget_tokens' Parameter (https://github.com/nbonamy/witsy/issues/392)
- MCP OAuth support (https://github.com/nbonamy/witsy/issues/398)
- Preserve markdown when using copy (https://github.com/nbonamy/witsy/issues/400)
- Improve the date/time value that is passed in system instructions (https://github.com/nbonamy/witsy/issues/401)
- Add timestamps to the debug console (https://github.com/nbonamy/witsy/issues/402)

### Changed
- Agentic handling of MCP errors (https://github.com/nbonamy/witsy/issues/366)

### Fixed
- Expert name display in chat
- Multiple artifacts display fix, partial artifacts display fix

### Removed
- N/A


## [2.13.1] - 2025-08-13

### Added
- Artifacts instructions option with specific display mode
- Show the model that was used for each response (https://github.com/nbonamy/witsy/issues/387)
- Add Support for Advanced Model Parameters like 'Thinking Mode' and 'Thinking Budget' for Gemini (https://github.com/nbonamy/witsy/issues/385)

### Changed
- Soniox Real Time and Async Pull Request (https://github.com/nbonamy/witsy/pull/384)

### Fixed
- Mistral vision does not work (https://github.com/nbonamy/witsy/issues/382)
- PDF webpage content not extracted )https://github.com/nbonamy/witsy/issues/383)
- Add a copy button for the user part of the conversation too (https://github.com/nbonamy/witsy/issues/388)
- Hover selection highlight is smooshed, not centered (https://github.com/nbonamy/witsy/issues/390)

### Removed
- N/A


## [2.13.0] - 2025-08-08

This release introduces agents in Witsy! When Deep Research was relesed, it was built on top of an agent creation and execution framework that was not exposed through Witsy UI. This is now fixed. Head-over to the [Create you own agents](https://github.com/nbonamy/witsy/wiki/Creating-your-first-agents) tutorial to learn how to create multi-step workflow agents and have agents delegate tasks to other agents!

### Added
- [Create you own agents](https://github.com/nbonamy/witsy/wiki/Creating-your-first-agents)
- Document Repository file change monitoring (https://github.com/nbonamy/witsy/discussions/304)
- OpenAI GPT-5 model support (vision flag, verbosity) (https://github.com/nbonamy/witsy/issues/379)

### Changed
- N/A

### Fixed
- N/A

### Removed
- N/A


## [2.12.5 / 2.12.6] - 2025-08-06

### Added
- ChatGPT History Import (https://github.com/nbonamy/witsy/issues/378)

### Changed
- N/A

### Fixed
- API key field for a new provider should start out empty (https://github.com/nbonamy/witsy/issues/368)
- OpenAI responses API integration (https://github.com/nbonamy/witsy/issues/338)
- Deleted experts are still used when called from specific applications (https://github.com/nbonamy/witsy/issues/375)
- Refresh of Gemini embedding model in Embedding selector (https://github.com/nbonamy/witsy/issues/374)
- Using “provider order” breaks OpenRouter (https://github.com/nbonamy/witsy/issues/372)
- Deep Research mode tries to download a PDF instead of reading it (https://github.com/nbonamy/witsy/issues/371)

### Removed
- N/A


## [2.12.4] - 2025-07-31

### Added
- On macOS, Cmd-N should start a new chat (https://github.com/nbonamy/witsy/issues/363)

### Changed
- N/A

### Fixed
- Dialogs in settings can be cut-off (https://github.com/nbonamy/witsy/issues/359)
- Checkboxes always look checked in dark mode (https://github.com/nbonamy/witsy/issues/361)
- Plugins that are disabled in app settings, are still available and enabled in chat settings (https://github.com/nbonamy/witsy/issues/362)

### Removed
- N/A


## [2.12.3] - 2025-07-28

### Added
- N/A

### Changed
- N/A

### Fixed
- N/A

### Removed
- Soniox STT support (https://github.com/nbonamy/witsy/issues/355)


## [2.12.2] - 2025-07-27

### Added
- Tooltips (https://github.com/nbonamy/witsy/discussions/344)
- OpenAI responses API integration (https://github.com/nbonamy/witsy/issues/338)
- Allow specifying allowed providers for OpenRouter (https://github.com/nbonamy/witsy/issues/350)
- Soniox STT (https://github.com/nbonamy/witsy/pull/353) 

### Changed
- Specific models to create chat title
- Allow empty prompts with attachments (https://github.com/nbonamy/witsy/pull/351)

### Fixed
- Create / edit commands : cannot create new line (https://github.com/nbonamy/witsy/issues/348)

### Removed
- N/A


## [2.12.1] - 2025-07-23

### Added
- Google video creation
- Mistral Voxtral STT models support (@ljbred08)
- Support for New Gemini Embedding model (https://github.com/nbonamy/witsy/issues/322)

### Changed
- N/A

### Fixed
- xAI image generation
- STT/Whisper: "language" parameter should not be sent (https://github.com/nbonamy/witsy/issues/340)
- Gladia STT: Maximum Call stack size exceeded (https://github.com/nbonamy/witsy/issues/341)

### Removed
- N/A


## [2.12.0] - 2025-07-20

### Added
- Add, Edit & Delete System Prompts (https://github.com/nbonamy/witsy/issues/308)
- Backup/Restore of data and settings
- Onboarding experience
- Japanese localization (https://github.com/nbonamy/witsy/pull/326)
- Design Studio image drop and image paste
- Design Studio prompt library

### Changed
- Document Repository UI update 

### Fixed
- Design Studio History label overflow fix
- Duplicated models (https://github.com/nbonamy/witsy/issues/331)
- Ctrl+Shift+C does not copy transcript and close transcript window (https://github.com/nbonamy/witsy/issues/336)
- Error when using Eleven Labs for Transcription (https://github.com/nbonamy/witsy/issues/335)
- Wrong position of delete shortcut buttons at shortcut settings (https://github.com/nbonamy/witsy/issues/334)
- Mermaid chart fixes and improvements (https://github.com/nbonamy/witsy/issues/333)
- Google image generation

### Removed
- Google image edit ([not supported by Google API](https://github.com/googleapis/js-genai/blob/36a14e4e05e8808ba65ed392b869be7d9840220b/src/models.ts#L985))


## [2.11.2] - 2025-07-14

### Added
- N/A

### Changed
- N/A 

### Fixed
- xAI function calling (https://github.com/nbonamy/witsy/issues/317)
- Settings Commands and Experts display issue

### Removed
- N/A


## [2.11.1] - 2025-07-14

### Added
- Support for Elevenlabs custom voices (https://github.com/nbonamy/witsy/issues/313)
- MCP Server label (https://github.com/nbonamy/witsy/pull/303)
- Exa native search engine (https://github.com/nbonamy/witsy/issues/310)

### Changed
- N/A 

### Fixed
- MCP Server start when using Nushell (https://github.com/nbonamy/witsy/issues/315) 

### Removed
- N/A


## [2.11.0] - 2025-07-07

### Added
- Custom HTTP Headers for MCP Streamable
- File upload for transcriptions (with dropzone)
- Summarize/Translate/Run AI command for transcription
- Drag and drop to attach files

### Changed
- N/A 

### Fixed
- N/A 

### Removed
- N/A


## [2.10.0] - 2025-07-03

### Added
- DeepResearch
- Fileystem plugin to read/write local files

### Changed
- Text headings font size and spacing 

### Fixed
- PDF export when tools displayed
- Fullscreen exit requiring multiple clicks
- YouTube transcript download
- Duplicate MCP servers sent to model ([#302](https://github.com/nbonamy/witsy/issues/302))

### Removed
- N/A
