
<img src="https://github.com/nbonamy/witsy/actions/workflows/test.yml/badge.svg">

# Witsy

Generative AI desktop application:
- OpenAI, Ollama, Anthropic, MistralAI, Google and Groq models supported
- Chat completion and image generation with Vision models support
- Prompt anywhere allows to generate content directly in any application
- AI commands runnable on highlighted text in almost any application
- Special prompts to specialize your bot on a specific topic
- LLM plugins to augment LLM: execute python code, search the Internet...
- Read aloud of assistant messages (requires OpenAI API key)
- Local history of conversations (with automatic titles)
- Formatting and copy to clipboard of generated code
- Image copy and download

<p align="center">
  <img src="doc/main1.jpg" height="250" />&nbsp;&nbsp;
  <img src="doc/main2.jpg" height="250" />
</p>

## Prompt Anywhere

Generate content in any application:
- From any editable content in any application
- Hit the Prompt anywhere shortcut (Shift+Control+Space / ^⇧Space)
- Enter your prompt in the window that pops up
- Watch Witsy enter the text directly in your application!

## AI Commands

AI commands are quick helpers accessible from a shortcut that leverage LLM to boost your productivity:
- Select any text in any application
- Hit the AI command shorcut (Alt+Control+Space / ⌃⌥Space)
- Select one of the commands and let LLM do their magic!

You can also create custom commands with the prompt of your liking!

<p align="center">
  <img src="doc/commands1.jpg" height="200" />&nbsp;&nbsp;
  <img src="doc/commands2.jpg" height="200" />&nbsp;&nbsp;
  <img src="doc/commands3.jpg" height="200" />
</p>

Commands inspired by [https://the.fibery.io/@public/Public_Roadmap/Roadmap_Item/AI-Assistant-via-ChatGPT-API-170](https://the.fibery.io/@public/Public_Roadmap/Roadmap_Item/AI-Assistant-via-ChatGPT-API-170).

## Prompts

From [https://github.com/f/awesome-chatgpt-prompts](https://github.com/f/awesome-chatgpt-prompts).

## Setup

You can download a binary from the Releases page or build yourself:
```
npm install
npm start
```

## Prerequisites

To use OpenAI, Anthropic, Google or Mistral AI models, you need to enter your API key:
- [OpenAI](https://platform.openai.com/api-keys)
- [Anthropic](https://console.anthropic.com/settings/keys)
- [MistralAI](https://console.mistral.ai/api-keys/)
- [Google](https://aistudio.google.com/app/apikey)

To use Ollama models, you need to install [Ollama](https://ollama.com) and download some [models](https://ollama.com/library).

To use text-to-speech, you need an [OpenAI API key](https://platform.openai.com/api-keys).

To use Internet search you need a [Tavily API key](https://app.tavily.com/home).

<p align="center">
  <img src="doc/settings.jpg" height="250" />&nbsp;&nbsp;
</p>

## TODO

- [ ] i18n
- [ ] File upload for retrieval (??)
- [ ] Proper database (SQLite3) storage (??)

## DONE

- [x] Ollama base URL as settings
- [x] OpenAI base URL as settings
- [x] DALL-E as tool
- [x] Google Gemini API
- [x] Prompt anywhere
- [x] Cancel commands
- [x] GPT-4o support
- [x] Different default engine/model for commands
- [x] Text attachments (TXT, PDF, DOCX, PPTX, XLSX)
- [x] MistralAI function calling
- [x] Auto-update
- [x] History date sections
- [x] Multiple selection delete
- [x] Search
- [x] Groq API
- [x] Custom prompts
- [x] Sandbox & contextIsolation
- [x] Application Menu
- [x] Prompt history navigation
- [x] Ollama model pull
- [x] macOS notarization
- [x] Fix when long text is highlighted
- [x] Shortcuts for AI commands
- [x] Shift to switch AI command behavior
- [x] User feedback when running a tool
- [x] Download internet content plugin
- [x] Tavily Internet search plugin
- [x] Python code execution plugin
- [x] LLM Tools supprt (OpenAI only)
- [x] Mistral AI API integration
- [x] Latex rendering
- [x] Anthropic API integration
- [x] Image generation as b64_json
- [x] Text-to-speech
- [x] Log file (electron-log)
- [x] Conversation language settings
- [x] Paste image in prompt
- [x] Run commands with default models
- [x] Models refresh
- [x] Edit commands
- [x] Customized commands
- [x] Conversation menu (info, save...)
- [x] Conversation depth setting
- [x] Save attachment on disk
- [x] Keep running in system tray
- [x] Nicer icon (still temporary)
- [x] Rename conversation
- [x] Copy/edit messages
- [x] New chat window for AI command
- [x] AI Commands with shortcut
- [x] Auto-switch to vision model
- [x] Run at login
- [x] Shortcut editor
- [x] Chat font size settings
- [x] Image attachment for vision
- [x] Stop response streaming
- [x] Save/Restore window position
- [x] Ollama support
- [x] View image full screen
- [x] Status/Tray bar icon + global shortcut to invoke
- [x] Chat themes
- [x] Default instructions in settings
- [x] Save DALL-E images locally (and delete properly)
- [x] OpenAI links in settings
- [x] Copy code button
- [x] Chat list ordering
- [x] OpenAI model choice
- [x] CSS variables
