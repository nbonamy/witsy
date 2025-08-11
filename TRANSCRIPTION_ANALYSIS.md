# Witsy Transcription System Analysis

This document explores how Witsy handles both asynchronous and real-time transcription across different engines and models, examining both frontend and backend implementations.

## Architecture Overview

### Core Components
- **STT Engine Interface** (`src/voice/stt.ts`): Defines the contract for all transcription engines
- **Transcriber Composable** (`src/composables/transcriber.ts`): Vue composable providing high-level transcription API
- **Audio Recorder** (`src/composables/audio_recorder.ts`): Handles audio input and streaming
- **Transcribe Screen** (`src/screens/Transcribe.vue`): Main UI for transcription functionality
- **Automation Layer** (`src/automations/transcriber.ts`): Handles text insertion into other apps

### STT Engine Interface

All transcription engines implement the `STTEngine` interface with these key methods:

```typescript
interface STTEngine {
  // Standard async transcription
  transcribe(audioBlob: Blob, opts?: object): Promise<TranscribeResponse>
  transcribeFile?(file: File, opts?: object): Promise<TranscribeResponse>
  
  // Real-time streaming
  isStreamingModel(model: string): boolean
  requiresPcm16bits?(model: string): boolean
  startStreaming?(model: string, callback: StreamingCallback, opts?: object): Promise<void>
  sendAudioChunk?(chunk: Blob): Promise<void>
  endStreaming?(): Promise<void>
  
  // Model management
  requiresDownload(): boolean
  isModelDownloaded(model: string): Promise<boolean>
  deleteModel(model: string): Promise<void>
}
```

## Transcription Engine Implementations

### Asynchronous (File-based) Engines

#### 1. OpenAI STT (`src/voice/stt-openai.ts`)
- **Models**: `gpt-4o-transcribe`, `gpt-4o-mini-transcribe`, `whisper-1`
- **Type**: Online API-based
- **Features**: 
  - Supports file upload transcription
  - Language detection
  - No streaming support
- **Implementation**: Uses OpenAI's `/audio/transcriptions` endpoint

#### 2. Groq STT (`src/voice/stt-groq.ts`)
- **Models**: `whisper-large-v3-turbo`, `distil-whisper-large-v3-en`, `whisper-large-v3`
- **Type**: Online API-based
- **Features**: 
  - Fast Whisper-based transcription
  - No streaming support
- **Implementation**: Uses Groq SDK for Whisper models

#### 3. Gladia STT (`src/voice/stt-gladia.ts`)
- **Models**: `solaria`
- **Type**: Online API-based
- **Features**:
  - Multi-step process (upload → transcribe → retrieve)
  - No streaming support
- **Implementation**: Custom HTTP API integration

#### 4. Local Whisper (`src/voice/stt-whisper.ts`)
- **Models**: `Xenova/whisper-tiny`, `Xenova/whisper-base`, `Xenova/whisper-small`, `Xenova/whisper-medium`
- **Type**: Local browser-based using HuggingFace Transformers
- **Features**:
  - Requires model download
  - Runs entirely offline
  - Progress callbacks for download/initialization
- **Implementation**: Uses `@huggingface/transformers` with WebAssembly

### Real-time (Streaming) Engines

#### 1. Speechmatics STT (`src/voice/stt-speechmatics.ts`)
- **Models**: `realtime` (Standard), `enhanced` (Enhanced)
- **Type**: WebSocket-based streaming
- **Features**:
  - JWT authentication
  - Partial and final transcripts
  - Vocabulary enhancement
  - Language-specific punctuation handling
- **Implementation**: Uses `@speechmatics/real-time-client` SDK
- **Streaming Flow**:
  1. Create JWT token with API key
  2. Establish WebSocket connection
  3. Stream audio chunks in real-time
  4. Receive partial and final transcription messages

#### 2. Fireworks STT (`src/voice/stt-fireworks.ts`)
- **Models**: `realtime`
- **Type**: WebSocket-based streaming
- **Features**:
  - Requires 16-bit PCM audio
  - Real-time transcription with segments
  - Custom vocabulary support
- **Implementation**: Direct WebSocket to `wss://audio-streaming.us-virginia-1.direct.fireworks.ai`
- **Streaming Flow**:
  1. Establish WebSocket with API key in query params
  2. Send raw audio chunks
  3. Receive segmented transcription data
  4. Aggregate segments for final text

#### 3. Soniox STT (`src/voice/stt-soniox.ts`)
- **Models**: `stt-async-preview` (async), `stt-rt-preview` (realtime)
- **Type**: Hybrid - supports both async and real-time
- **Features**:
  - WebSocket for real-time
  - REST API for async
  - Binary audio frames
  - Endpoint detection
- **Implementation**: Custom WebSocket protocol to `wss://stt-rt.soniox.com`

#### 4. Other Engines with Limited Streaming
- **FalAI, Nvidia, HuggingFace, Mistral**: Some support streaming but primarily async-focused

## Frontend Implementation

### Transcribe Screen (`src/screens/Transcribe.vue`)

The main transcription UI provides:

#### State Management
```typescript
type State = 'idle'|'initializing'|'recording'|'processing'
```

#### Recording Modes
- **Standard Recording**: Click to start/stop
- **Push-to-Talk**: Hold space bar to record
- **Auto-start**: Begin recording immediately on screen load
- **File Upload**: Drag & drop or select audio files

#### Real-time Features
- **Live Waveform**: Visual audio input feedback via `Waveform.vue`
- **Streaming Text**: Updates transcription in real-time as audio is processed
- **Audio Chunking**: Sends audio data in chunks to streaming engines

#### Key Methods
- `onRecord()`: Initiates recording with streaming setup
- `toggleRecord()`: Handles space bar toggle functionality
- `transcribe()`: Processes recorded audio for async engines
- `initializeAudio()`: Sets up audio recorder with streaming callbacks

### Transcriber Composable (`src/composables/transcriber.ts`)

Provides high-level transcription functionality:

#### Core Features
- **Engine Abstraction**: Manages different STT engines uniformly
- **Streaming Detection**: Automatically determines if model requires streaming
- **Error Handling**: Processes streaming errors with user-friendly dialogs
- **Audio Format**: Handles conversion between audio formats

#### Key Properties
- `requiresStreaming`: Boolean indicating if current model needs real-time processing
- `requiresPcm16bits`: Whether engine needs 16-bit PCM audio format
- `ready`: Engine initialization status

### Audio Recorder (`src/composables/audio_recorder.ts`)

Handles audio input with support for both recording modes:

#### Features
- **MediaRecorder API**: Browser-based audio capture
- **Real-time Chunking**: Sends audio chunks during recording for streaming
- **Silence Detection**: Automatic recording termination
- **Format Support**: Configurable audio formats (WebM, PCM16)
- **Noise Detection**: Filters out recordings without speech

## Backend Implementation

### Window Management (`src/main/windows/transcribe.ts`)
- Simple routing to open transcription screen in main window

### IPC Integration (`src/main/ipc.ts`)
- Handles `transcribe.insert` IPC calls to insert text into other applications

### Automation Integration (`src/automations/transcriber.ts`)
- `initTranscription()`: Opens transcription palette
- `insertTranscription()`: Uses automation system to paste transcribed text

## Transcription Flow Comparison

### Asynchronous Flow
1. User starts recording or uploads file
2. Audio is captured/loaded completely
3. Audio blob sent to STT engine API
4. Wait for transcription response
5. Display final text result
6. Optional: Insert into other applications

### Real-time Streaming Flow
1. User starts recording
2. Audio recorder initializes with streaming callbacks
3. STT engine establishes WebSocket/streaming connection
4. Audio chunks sent continuously during recording
5. Partial transcription results received and displayed
6. Final transcription compiled when recording stops
7. Optional: Insert into other applications

## Detailed Engine Analysis

### Hybrid Engine: Soniox Deep Dive

Soniox represents the most sophisticated implementation in the codebase, supporting both async and real-time transcription modes through different API endpoints and protocols.

#### Soniox Async Implementation
The async workflow follows a 5-step process:
1. **File Upload**: `POST /v1/files` - Upload audio blob to Soniox servers
2. **Transcription Creation**: `POST /v1/transcriptions` with file_id and model parameters
3. **Status Polling**: `GET /v1/transcriptions/{id}` - Poll until status becomes "completed" or "error"
4. **Transcript Retrieval**: `GET /v1/transcriptions/{id}/transcript` - Fetch the final text
5. **Optional Cleanup**: `DELETE` both transcription and file resources

```typescript
// Key configuration options for Soniox
soniox: {
  languageHints?: string[]         // Custom vocabulary hints
  endpointDetection?: boolean      // Automatic speech endpoint detection
  cleanup?: boolean                // Auto-delete files after transcription
  audioFormat?: string            // Audio format specification ("auto")
  proxy?: 'temporary_key'         // Security mode for WebSocket
  tempKeyExpiry?: number          // Temporary key lifespan (seconds)
  speakerDiarization?: boolean    // Multi-speaker identification
}
```

#### Soniox Real-time Streaming
Real-time mode uses WebSocket with sophisticated token-based streaming:

1. **Authentication**: 
   - Primary: Direct API key
   - Secure: Temporary API key generation via `POST /v1/auth/temporary-api-key`
2. **WebSocket Connection**: `wss://stt-rt.soniox.com/transcribe-websocket`
3. **Configuration Message**: JSON config with model, audio format, and features
4. **Audio Streaming**: Binary audio chunks sent continuously
5. **Token Processing**: Receives `{text: string, is_final: boolean}` tokens
6. **End-of-Stream**: Empty binary frame signals completion

```typescript
// Streaming token aggregation pattern
for (const token of data.tokens) {
  if (token.is_final) this.finalTranscript += token.text
  else partial += token.text
}
const content = (this.finalTranscript + partial).trim()
```

### Streaming Architecture Patterns

#### Callback-based Event Handling
All streaming engines implement a unified callback interface:

```typescript
export type StreamingChunk = 
  | { type: 'text', content: string }      // Transcription text
  | { type: 'status', status: STTStatus }  // Connection status
  | { type: 'error', status: STTStatus, error: string }

export type StreamingCallback = (chunk: StreamingChunk) => void
```

#### Engine-Specific Streaming Patterns

**Speechmatics Pattern**:
- SDK-based approach using `@speechmatics/real-time-client`
- JWT authentication with time-limited tokens
- Partial vs. final transcript distinction
- Punctuation normalization based on language

**Fireworks Pattern**:
- Direct WebSocket implementation
- Query parameter authentication
- Segment-based transcript aggregation
- 16-bit PCM requirement

**Soniox Pattern**:
- Temporary API key security model
- Token-based streaming with finality flags
- Advanced features (speaker diarization, endpoint detection)
- Binary frame end-of-stream signaling

### Audio Processing Pipeline

#### MediaRecorder Integration
```typescript
interface AudioRecorderListener {
  onNoiseDetected: () => void
  onSilenceDetected: () => void           // Auto-stop trigger
  onRecordingComplete: (chunks, detected) => void
  onAudioChunk: (chunk: Blob) => void     // Real-time streaming
}
```

#### Format-Specific Processing
- **WebM/Opus**: Default browser format for most engines
- **16-bit PCM**: Required for Fireworks, processed via AudioWorklet
- **Multi-format**: Soniox supports flexible audio format detection

#### Streaming Data Flow
```
User Speech → MediaRecorder → AudioWorklet (if PCM16) → 
WebSocket/HTTP Stream → STT Service → Partial Results → 
UI Updates → Aggregated Final Transcript
```

## Engine Selection Strategy

### Async Engines (File-based)
- **Best for**: Batch processing, file transcription, offline scenarios
- **Examples**: OpenAI Whisper, Groq, Local Whisper, Gladia, Soniox Async
- **Advantages**: Often higher accuracy, better for longer audio, cost-effective
- **Disadvantages**: Latency, no live feedback, requires complete audio

### Streaming Engines (Real-time)  
- **Best for**: Live transcription, dictation, interactive use cases
- **Examples**: Speechmatics, Fireworks, Soniox RT
- **Advantages**: Immediate feedback, better UX, partial results
- **Disadvantages**: Network dependency, higher costs, complexity

### Hybrid Engines
- **Soniox**: Only engine supporting both modes seamlessly
- **Flexibility**: Choose mode based on use case
- **Advanced Features**: Speaker diarization, endpoint detection, custom vocabularies

## Configuration and Settings

### STT Configuration (`src/types/config.ts`)
```typescript
stt: {
  engine: string        // Selected engine
  model: string         // Model within engine  
  locale: string        // Language code
  autoStart: boolean    // Start recording on screen open
  pushToTalk: boolean   // Use push-to-talk mode
  vocabulary: Array     // Custom vocabulary for enhancement
}
```

### Per-Engine Settings
Each engine can have specific configurations:
- API keys and authentication
- Custom endpoints (for compatible engines)
- Model-specific parameters
- Audio format requirements

## Error Handling

### Streaming Error Types
```typescript
type STTStatus = 'connected' | 'text' | 'done' | 'not_authorized' | 'out_of_credits' | 'quota_reached' | 'error'
```

### Error Processing
- **Authentication Errors**: Prompt user to configure API keys
- **Quota/Credit Errors**: Display user-friendly messages
- **Network Errors**: Graceful degradation and retry logic
- **Audio Errors**: Microphone permission and hardware issues

## Performance Considerations

### Memory Management
- Audio chunks are processed and released promptly
- Streaming connections are properly cleaned up
- Local models are cached but can be deleted to save space

### Network Optimization
- Streaming engines send smaller, frequent chunks
- Async engines send complete audio files
- Proper connection cleanup prevents resource leaks

### Browser Compatibility
- Feature detection for MediaRecorder API
- Fallback handling for unsupported MIME types
- Cross-platform audio format handling

## Testing Architecture and Validation Patterns

### Testing Strategy for STT Engines

The codebase demonstrates sophisticated testing patterns for both async and streaming transcription:

#### Mock-based Testing (`tests/unit/stt-soniox.test.ts`)
```typescript
// Async transcription test with fetch mocking
const fetchMock = vi
  .fn()
  .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'file-1' }) })  // Upload
  .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'tr-1' }) })   // Create
  .mockResolvedValueOnce({ ok: true, json: async () => ({ status: 'completed' }) }) // Poll
  .mockResolvedValueOnce({ ok: true, json: async () => ({ text: 'hello world' }) }) // Result

// WebSocket streaming simulation with timing control
class MockWebSocket {
  readyState = 0
  onopen: any; onmessage: any; onerror: any; onclose: any
  constructor(public url: string) {
    setTimeout(() => {
      this.readyState = 1 // OPEN
      this.onopen?.()
      // Simulate streaming tokens
      this.onmessage?.({
        data: JSON.stringify({
          tokens: [
            { text: 'Hallo ', is_final: false },
            { text: 'Welt', is_final: true },
          ],
        }),
      })
    }, 10)
  }
}
```

#### Key Testing Patterns
1. **Multi-step API Workflow**: Testing complete async transcription pipeline
2. **WebSocket State Management**: Proper connection lifecycle testing
3. **Token Aggregation Logic**: Verifying partial vs. final transcript handling
4. **Error Condition Testing**: Authentication, network, and parsing failures
5. **Configuration Validation**: Testing various engine-specific settings

### Architectural Deep-Dive: Discovery Through Analysis

#### Advanced Configuration Patterns
The Soniox implementation reveals sophisticated configuration management:

```typescript
// Security-aware streaming setup
let wsApiKey = apiKey
if (proxyMode === 'temporary_key') {
  const tempKeyResponse = await fetch('https://api.soniox.com/v1/auth/temporary-api-key', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      usage_type: 'transcribe_websocket', 
      expires_in_seconds: tempKeyExpiry 
    }),
  })
  const { api_key } = await tempKeyResponse.json()
  if (api_key) wsApiKey = api_key
}
```

#### Error Handling Sophistication
```typescript
// Comprehensive error status mapping
export type STTStatus = 
  | 'connected' | 'text' | 'done' 
  | 'not_authorized' | 'out_of_credits' | 'quota_reached' | 'error'
  
// Engine-specific error processing
this.ws.onerror = (event: Event) => {
  this.pendingError = (event as ErrorEvent)?.message || 'Soniox WebSocket error'
}
this.ws.onclose = () => {
  if (this.pendingError) callback({ type: 'error', status: 'error', error: this.pendingError })
  else callback({ type: 'status', status: 'done' })
}
```

#### Performance Optimization Patterns
1. **Connection Reuse**: WebSocket instances maintained until explicitly closed
2. **Resource Cleanup**: Optional file/transcription deletion in async mode
3. **Temporary Credentials**: Reduced security exposure for streaming
4. **Audio Format Flexibility**: Engine-specific format handling

### Discovered Architectural Insights

#### Dependency Injection Pattern
```typescript
// Factory pattern with configuration injection
export const getSTTEngine = (config: Configuration): STTEngine => {
  const engine = config.stt.engine || 'whisper'
  switch(engine) {
    case 'soniox': return new STTSoniox(config)
    // ... other engines
  }
}
```

#### State Management Patterns
- **Streaming State**: Boolean flags for connection status
- **Transcript Accumulation**: Separate handling of partial vs. final text
- **Error State**: Pending error tracking for asynchronous error reporting

#### Cross-Platform Audio Handling
```typescript
// Format detection and requirements
requiresPcm16bits?(model: string): boolean {
  return model === 'fireworks-realtime' // Engine-specific
}

// AudioWorklet integration for format conversion
pcm16bitStreaming: transcriber.requiresPcm16bits,
listener: {
  onAudioChunk: async (chunk) => {
    if (transcriber.streaming) {
      await transcriber.sendStreamingChunk(chunk)
    }
  }
}
```

## Future Extensibility and Architectural Evolution

### Recommended Architecture Enhancements

#### 1. Abstract Engine Base Classes
```typescript
abstract class BaseSTTEngine implements STTEngine {
  protected config: Configuration
  protected connectionState: 'idle' | 'connecting' | 'connected' | 'error' = 'idle'
  
  // Common error handling
  protected handleStreamingError(error: string): StreamingChunk {
    return { type: 'error', status: 'error', error }
  }
  
  // Common initialization patterns
  async initialize(callback?: ProgressCallback): Promise<void> {
    this.connectionState = 'connecting'
    await this.doInitialize(callback)
    this.connectionState = 'connected'
  }
  
  protected abstract doInitialize(callback?: ProgressCallback): Promise<void>
}

class HTTPBasedSTTEngine extends BaseSTTEngine {
  // Common patterns for API-based engines
}

class WebSocketSTTEngine extends BaseSTTEngine {
  // Common patterns for streaming engines
  protected ws: WebSocket | null = null
  
  protected async establishWebSocket(url: string, protocols?: string[]): Promise<WebSocket> {
    // Common WebSocket setup with reconnection logic
  }
}
```

#### 2. Enhanced Plugin Architecture
```typescript
interface STTEnginePlugin {
  name: string
  models: Model[]
  createEngine(config: Configuration): STTEngine
  validateConfiguration(config: any): ValidationResult
}

class STTEngineRegistry {
  private plugins = new Map<string, STTEnginePlugin>()
  
  register(plugin: STTEnginePlugin): void {
    this.plugins.set(plugin.name, plugin)
  }
  
  create(engineName: string, config: Configuration): STTEngine {
    const plugin = this.plugins.get(engineName)
    if (!plugin) throw new Error(`Unknown STT engine: ${engineName}`)
    return plugin.createEngine(config)
  }
}
```

#### 3. Advanced Stream Processing
```typescript
interface StreamProcessor {
  process(chunk: StreamingChunk): StreamingChunk[]
  finalize(): StreamingChunk[]
}

class PunctuationProcessor implements StreamProcessor {
  // Language-specific punctuation handling
}

class SentenceSegmenter implements StreamProcessor {
  // Break text into sentences for better UX
}

class ConfidenceFilter implements StreamProcessor {
  // Filter low-confidence results
}
```

### Future Integration Opportunities

#### 1. Multi-Engine Orchestration
- **Consensus Transcription**: Run multiple engines simultaneously
- **Fallback Chains**: Automatic engine switching on failure
- **Quality Scoring**: Engine selection based on historical performance

#### 2. Advanced Audio Processing
- **Noise Reduction**: Pre-processing for better accuracy
- **Multi-channel Support**: Separate speaker channels
- **Audio Enhancement**: Real-time audio improvement

#### 3. Result Post-Processing
- **Grammar Correction**: LLM-based text improvement
- **Custom Formatting**: Domain-specific text formatting
- **Confidence Scoring**: Per-word or per-phrase confidence metrics

The architecture demonstrates exceptional extensibility while maintaining clean separation of concerns. The unified interface pattern, comprehensive error handling, and configuration-driven approach provide a solid foundation for supporting diverse transcription providers while delivering consistent user experiences across all modalities.