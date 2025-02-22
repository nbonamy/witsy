
<div align="center">

  <a href="https://witsyai.com" target="_blank"><img src="assets/icon.png" width="128" alt="Witsy Logo"></a>
  <div><b>Witsy</b></div>
  <div>Desktop AI Assistant</div>

</div>

<p></p>
<div align="center">

[![Version Badge](https://img.shields.io/endpoint?url=https://gist.githubusercontent.com/nbonamy/8febadb1ecb32078db4c003d0c09f565/raw/version.json)](https://github.com/nbonamy/witsy/releases)
[![Downloads Badge](https://img.shields.io/github/downloads/nbonamy/witsy/total.svg?color=orange)](https://tooomm.github.io/github-release-stats/?username=nbonamy&repository=witsy)
[![Test Badge](https://github.com/nbonamy/witsy/actions/workflows/test.yml/badge.svg)](https://github.com/nbonamy/witsy/blob/main/.github/workflows/test.yml)
[![Coverage Badge](https://img.shields.io/endpoint?url=https://gist.githubusercontent.com/nbonamy/8febadb1ecb32078db4c003d0c09f565/raw/witsy__main.json)](https://github.com/nbonamy/witsy/blob/main/.github/workflows/test.yml)

</div>

## Downloads

Download Witsy from [witsyai.com](https://witsyai.com) or from the [releases](https://github.com/nbonamy/witsy/releases) page.


## What is Witsy?

Witsy is a BYOK (Bring Your Own Keys) AI application: it means you need to have API keys for the LLM providers you want to use. Alternatively,
you can use [Ollama](https://ollama.com) to run models locally on your machine for free and use them in Witsy.

Non-exhaustive feature list:
- OpenAI, Ollama, Anthropic, MistralAI, Google, xAI, OpenRouter, DeepSeek, Groq and Cerebras models supported
- Connect other providers (together, siliconflow, fireworks...) through OpenAI compatibility layer
- Chat completion with vision models support (describe an image)
- Text-to-image and text-to video with OpenAI, HuggingFace and Replicate
- Scratchpad to interactively create the best content with any model!
- Prompt anywhere allows to generate content directly in any application
- AI commands runnable on highlighted text in almost any application
- Experts prompts to specialize your bot on a specific topic
- LLM plugins to augment LLM: execute python code, search the Internet...
- Long-term memory plugin to increase relevance of LLM answers
- Read aloud of assistant messages (requires OpenAI or ElevenLabs API key)
- Read aloud of any text in other applications (requires OpenAI or ElevenLabs API key)
- Chat with your local files and documents (RAG)
- Transcription/Dictation (Speech-to-Text)
- Realtime Chat aka Voice Mode
- Anthropic Computer Use support
- Local history of conversations (with automatic titles)
- Formatting and copy to clipboard of generated code
- Conversation PDF export
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

On Mac, you can define an expert that will automatically be triggered depending on the foreground application. For instance, if you have an expert used to generate linux commands, you can have it selected if you trigger Prompt Anywhere from the Terminal application!

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

## Experts

From [https://github.com/f/awesome-chatgpt-prompts](https://github.com/f/awesome-chatgpt-prompts).

## Scratchpad

https://www.youtube.com/watch?v=czcSbG2H-wg

## Chat with your documents (RAG)

You can connect each chat with a document repository: Witsy will first search for relevant documents in your local files and provide this info to the LLM. To do so:

- Click on the database icon on the left of the prompt
- Click Manage and then create a document repository
- OpenAI Embedding require on API key, Ollama requires an embedding model
- Add documents by clicking the + button on the right hand side of the window
- Once your document repository is created, click on the database icon once more and select the document repository you want to use. The icon should turn blue

## Transcription / Dictation (Speech-to-Text)

You can transcribe audio recorded on the microphone to text. Transcription can be done using OpenAI Whisper online model (requires API key) or using local Whisper model (requires download of large files). Once the text is transcribed you can:

- Copy it to your clipboard
- Insert it in the application that was running before you activated the dictation

## Anthropic Computer Use

https://www.youtube.com/watch?v=vixl7I07hBk


## Setup

You can download a binary from from [witsyai.com](https://witsyai.com), from the [releases](https://github.com/nbonamy/witsy/releases) page or build yourself:

```
npm install
npm start
```

## Prerequisites

To use OpenAI, Anthropic, Google or Mistral AI models, you need to enter your API key:
- [OpenAI](https://platform.openai.com/api-keys)
- [Anthropic](https://console.anthropic.com/settings/keys)
- [xAI](https://console.x.ai/team/)
- [Google](https://aistudio.google.com/app/apikey)
- [MistralAI](https://console.mistral.ai/api-keys/)
- [DeepSeek](https://platform.deepseek.com/api_keys)
- [OpenRouter](https://openrouter.ai/settings/keys)
- [Groq](https://console.groq.com/keys)
- [Cerebras](https://cloud.cerebras.ai/platform/)
- [GitHub](https://github.com/settings/tokens)

To use Ollama models, you need to install [Ollama](https://ollama.com) and download some [models](https://ollama.com/library).

To use text-to-speech, you need an [OpenAI API key](https://platform.openai.com/api-keys).

To use Internet search you need a [Tavily API key](https://app.tavily.com/home).

<p align="center">
  <img src="doc/settings.jpg" height="250" />&nbsp;&nbsp;
</p>

## TODO

- [ ] i18n
- [ ] Proper database (SQLite3) storage (??)

## WIP


## DONE

- [x] Local Web Search
- [x] Model defaults
- [x] Speech-to-text language
- [x] Model parameters (temperature...)
- [x] Favorite models
- [x] ElevenLabs Text-to-Speech
- [x] Custom engines (OpenAI compatible)
- [x] Long-term memory plugin
- [x] OpenRouter support
- [x] DeepSeek support
- [x] Folder mode
- [x] All instructions customization
- [x] Fork chat (with optional LLM switch)
- [x] Realtime chat
- [x] Replicate video generation
- [x] Together.ai compatibility
- [x] Gemini 2.0 Flash support
- [x] Groq LLama 3.3 support
- [x] xAI Grok Vision Model support
- [x] Ollama function-calling
- [x] Replicate image generation
- [x] AI Commands redesign
- [x] Token usage report
- [x] OpenAI o1 models support
- [x] Groq vision support
- [x] Image resize option
- [x] Llama 3.2 vision support
- [x] YouTube plugin
- [x] RAG in Scratchpad
- [x] Hugging face image generation
- [x] Show prompt used for image generation
- [x] Redesigned Prompt window
- [x] Anthropic Computer Use
- [x] Auto-update refactor (still not Windows)
- [x] Dark mode
- [x] Conversation mode
- [x] Google function calling
- [x] Anthropic function calling
- [x] Scratchpad
- [x] Dictation: OpenAI Whisper + Whisper WebGPU
- [x] Auto-select expert based on foremost app (Mac only)
- [x] Cerebras support
- [x] Local files RAG
- [x] Groq model update (8-Sep-2024)
- [x] PDF Export of chats
- [x] Prompts renamed to Experts. Now editable.
- [x] Read aloud
- [x] Import/Export commands
- [x] Anthropic Sonnet 3.5
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
