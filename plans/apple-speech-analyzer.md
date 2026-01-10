# Apple SpeechAnalyzer Integration Plan

## Overview

Integrate Apple's new SpeechAnalyzer API (macOS 26+) as an STT engine option via a Swift CLI tool.

## Why CLI Tool Approach

- **Simpler**: No native addon boilerplate, no node-gyp complexity
- **Faster to implement**: Swift CLI is straightforward
- **Easier to maintain**: Separate binary, can update independently
- **Already proven**: Similar to how we handle other external tools

## Architecture

```
┌─────────────────────────────────┐      ┌──────────────────────────────┐
│  Witsy (Electron)               │      │  speech-analyzer-cli (Swift) │
│                                 │      │                              │
│  audioRecorder.start()          │      │                              │
│         ↓                       │      │                              │
│  user speaks (mic permission)   │      │                              │
│         ↓                       │      │                              │
│  audioRecorder.stop() → Blob    │      │                              │
│         ↓                       │      │                              │
│  save Blob to temp file         │      │                              │
│         ↓                       │      │                              │
│  spawn CLI with file path       │ ───► │  transcribe(file)            │
│                                 │      │         ↓                    │
│  parse JSON result              │ ◄─── │  SpeechAnalyzer API          │
│         ↓                       │      │         ↓                    │
│  return transcription           │      │  output JSON to stdout       │
└─────────────────────────────────┘      └──────────────────────────────┘
```

**Key point:** Recording happens in Electron (which has microphone permission). The CLI tool only receives audio files for transcription - no microphone access needed. This matches the existing pattern for non-streaming STT engines (Whisper, Groq, OpenAI, etc.).

## Implementation Phases

### Phase 1: Swift CLI Tool

Create a new Swift package in `tools/speech-analyzer-cli/`:

- [ ] Initialize Swift package with Speech framework dependency
- [ ] Implement CLI argument parsing (file path, locale, output format)
- [ ] Implement SpeechAnalyzer transcription logic
- [ ] Handle model download/availability checking
- [ ] Output JSON: `{ "text": "...", "segments": [...], "error": null }`
- [ ] Build universal binary (arm64 + x86_64)
- [ ] Test standalone with sample audio files

### Phase 2: Witsy Integration

- [ ] Add `stt-apple.ts` engine following existing patterns (see `stt-whisper.ts`)
- [ ] Implement `transcribe()` that spawns CLI tool
- [ ] Handle model availability check (CLI tool with `--check-model` flag)
- [ ] Add engine to `getSTTEngine()` factory in `stt.ts`
- [ ] Add "Apple" option in SettingsSTT.vue (macOS 26+ only)
- [ ] Add locale selection UI (use `--list-locales` from CLI)

### Phase 3: Model Management

- [ ] CLI tool: `--download-model <locale>` command
- [ ] CLI tool: `--list-installed` command
- [ ] UI: Show download progress/status in settings
- [ ] Handle "model not installed" error gracefully

### Phase 4: Testing & Polish

- [ ] Unit tests for stt-apple.ts
- [ ] Test with various audio formats (wav, mp3, m4a)
- [ ] Test with different locales
- [ ] Verify macOS version detection works correctly
- [ ] Update any relevant documentation

## CLI Tool Interface

```bash
# Transcribe audio file
speech-analyzer-cli --file audio.wav --locale en-US
# Output: {"text": "Hello world", "segments": [...]}

# Check if model is available
speech-analyzer-cli --check-model en-US
# Output: {"installed": true, "downloadSize": 0}

# Download model
speech-analyzer-cli --download-model en-US
# Output: {"success": true}

# List available locales
speech-analyzer-cli --list-locales
# Output: {"locales": ["en-US", "fr-FR", ...]}

# List installed models
speech-analyzer-cli --list-installed
# Output: {"installed": ["en-US", "es-ES"]}
```

## Distribution

The CLI binary will be:
- Built during app build process (or pre-built)
- Bundled in `resources/` directory
- Signed with app signature for notarization

## Commit Strategy

1. `feat: add speech-analyzer-cli swift tool`
2. `feat: add apple stt engine integration`
3. `feat: add apple stt settings ui`
4. `test: add apple stt engine tests`

## Limitations

- **No streaming**: CLI approach is file-based only. User must finish speaking before transcription starts. Given SpeechAnalyzer's speed (34min audio → 45sec processing), this should be acceptable.
- **macOS 26+ only**: Won't work on older macOS versions. Need graceful fallback to other engines.

## Open Questions

- [ ] How to handle CLI tool updates separately from app?
- [ ] Fallback behavior when macOS < 26? (hide option? show warning?)

## Requirements

- macOS 26+ (Tahoe)
- Xcode 17+ for building CLI tool
- Speech framework entitlements

## References

- [Apple SpeechAnalyzer Docs](https://developer.apple.com/documentation/speech/speechanalyzer)
- [WWDC25 Session 277](https://developer.apple.com/videos/play/wwdc2025/277/)
- [iOS 26 SpeechAnalyzer Guide](https://antongubarenko.substack.com/p/ios-26-speechanalyzer-guide)
