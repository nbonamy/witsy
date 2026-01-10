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

~~Create a new Swift package in `tools/speech-analyzer-cli/`:~~
**Used forked https://github.com/nbonamy/apple-speechanalyzer-cli-example instead**

- [x] ~~Initialize Swift package with Speech framework dependency~~ Used existing repo
- [x] ~~Implement CLI argument parsing (file path, locale, output format)~~ Already implemented
- [x] ~~Implement SpeechAnalyzer transcription logic~~ Already implemented
- [x] Handle model download/availability checking - Auto-downloads on first use
- [x] ~~Output JSON~~ Outputs plain text (simpler, no segments needed)
- [x] Build universal binary (arm64 + x86_64) - Created `build-universal.sh`
- [x] Test standalone with sample audio files - Tested with ~/Desktop/test.wav

### Phase 2: Witsy Integration

- [x] Add `stt-apple.ts` engine following existing patterns
- [x] Implement `transcribe()` that spawns CLI tool via IPC (main process)
- [x] ~~Handle model availability check~~ Not needed - auto-downloads
- [x] Add engine to `getSTTEngine()` factory in `stt.ts`
- [x] Add "Apple" option in SettingsSTT.vue (macOS 26+ only)
- [x] ~~Add locale selection UI~~ Already exists - uses existing LangSelect component

### Phase 3: Model Management

- [x] ~~CLI tool: `--download-model <locale>` command~~ Not needed - auto-downloads on first use
- [x] ~~CLI tool: `--list-installed` command~~ Not needed
- [x] ~~UI: Show download progress/status in settings~~ CLI outputs to stderr during download
- [x] Handle "model not installed" error gracefully - CLI handles download automatically

### Phase 4: Testing & Polish

- [ ] Unit tests for stt-apple.ts
- [ ] Test with various audio formats (wav, mp3, m4a)
- [ ] Test with different locales
- [ ] Verify macOS version detection works correctly (currently returns true on all macOS)
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
