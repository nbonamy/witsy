# Quick Dictation Mini-Window Feature

## Overview

Replace the current "Start Dictation" shortcut behavior with a minimal floating window that:
- Shows source app icon/name + waveform visualization
- Auto-starts recording on open
- On Escape or silence detection: stops, transcribes, inserts into source app
- Shows loader while transcribing
- Positioned at top center of screen (extending the macOS notch visually)

## Flow

```
User presses dictation shortcut
    ↓
Capture foremost app (getForemostApp)
    ↓
Open mini dictation window with sourceApp param
    ↓
Auto-start recording, show waveform
    ↓
On Escape OR silence detected
    ↓
Stop recording, show loader
    ↓
Transcribe audio
    ↓
Insert text into source app, close window
```

---

## Phase 1: Main Process Infrastructure

### 1.1 Create `src/main/windows/dictation.ts`

New window manager following `readaloud.ts` pattern:

```typescript
export let dictationWindow: BrowserWindow = null;
export const closeDictationWindow = async (sourceApp?: Application): Promise<void>
export const openDictationWindow = (params: anyDict): void
```

Window options:
- `hash: '/dictation'`
- `frame: false`, `skipTaskbar: true`, `alwaysOnTop: true`
- `resizable: false`, `hiddenInMissionControl: true`
- Size: ~320x64px
- Position: top center, near notch area on macOS

### 1.2 Add IPC constants in `src/ipc_consts.ts`

```typescript
export const DICTATION = {
  CLOSE: 'dictation-close',
} as const;
```

### 1.3 Update `src/main/ipc.ts`

Add handler:
- `DICTATION.CLOSE` - Close window and release focus to sourceApp

### 1.4 Update `src/preload.ts`

```typescript
dictation: {
  close: (sourceApp: Application): void => ipcRenderer.send(IPC.DICTATION.CLOSE, sourceApp),
}
```

### 1.5 Update `src/main/window.ts`

Export the new functions.

### 1.6 Modify `src/main/automations/transcriber.ts`

Update `initTranscription` to:
1. Capture foremost app via `automator.getForemostApp()`
2. Open `dictationWindow` with sourceApp param instead of full transcribe palette

**Commit 1**: Main process infrastructure (window, IPC, preload, transcriber modification)

---

## Phase 2: Vue Screen Implementation

### 2.1 Create `src/renderer/screens/Dictation.vue`

**State machine**: `idle → recording → processing → done`

**Template structure**:
```vue
<template>
  <div class="dictation">
    <div class="app-info">
      <img :src="iconData" class="icon" />
    </div>
    <div class="visualizer">
      <Loader v-if="state === 'processing'" />
      <Waveform v-else :audioRecorder="audioRecorder" :isRecording="state === 'recording'" ... />
    </div>
  </div>
</template>
```

**Key logic**:
- `onMounted`: Parse sourceApp, get app info/icon, init recorder, auto-start
- Keyboard: Escape → stop & transcribe
- `onSilenceDetected` → stop & transcribe
- `onRecordingComplete` → transcribe → insert → close

**Styling**:
- `-webkit-app-region: drag` for window dragging
- Flexbox row layout, dark background
- App icon left, waveform center

### 2.2 Update `src/renderer/App.vue`

Add route: `'/dictation': Dictation`

**Commit 2**: Vue screen implementation

---

## Phase 3: Refinements

### 3.1 Notch Positioning

In `dictation.ts`:
- Position Y at 0 or menu bar height to extend notch visually
- Use `getCurrentScreen()` for correct display
- Fallback for Macs without notch

### 3.2 Error Handling

- Microphone access errors → show message, close
- Transcription API errors → show message, close
- No speech detected → close without inserting

### 3.3 Edge Cases

- Linux doesn't support `getForemostApp()` → insert via clipboard paste
- Handle window close during transcription

**Commit 3**: Refinements (positioning, error handling)

---

## Phase 4: Tests

### 4.1 Update test mocks

In `tests/mocks/window.ts`:
```typescript
dictation: {
  close: vi.fn(),
}
```

### 4.2 Add unit tests

- `tests/unit/screens/dictation.test.ts` - Test component states and interactions

**Commit 4**: Tests

---

## Critical Files

| File | Action |
|------|--------|
| `src/main/windows/dictation.ts` | Create |
| `src/main/window.ts` | Modify (add exports) |
| `src/main/automations/transcriber.ts` | Modify (open mini window) |
| `src/ipc_consts.ts` | Modify (add DICTATION) |
| `src/main/ipc.ts` | Modify (add handlers) |
| `src/preload.ts` | Modify (add dictation API) |
| `src/renderer/screens/Dictation.vue` | Create |
| `src/renderer/App.vue` | Modify (add route) |
| `tests/mocks/window.ts` | Modify (add mocks) |

---

## Verification

1. Press dictation shortcut → mini window appears at top center
2. Waveform shows audio input
3. Press Escape → transcription happens → text inserted into source app
4. Let silence occur → same result as Escape
5. Window closes after insertion
6. `npm run lint` passes
7. `npm run test:ai` passes
