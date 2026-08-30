# G2: Voice (ASR/Input/TTS) — Test Report

## Summary

The desktop app already had voice input (Web Speech API composer dictation) and voice mode (OpenAI Realtime over WebRTC). Added TTS (text-to-speech) for reading assistant responses aloud.

## Existing Voice Features (Already Present)

1. **Composer Voice Dictation** — Web Speech API `SpeechRecognition` for speech-to-text in the chat input (`composer-voice-input.tsx`)
2. **Voice Mode Panel** — OpenAI Realtime over WebRTC for conversational voice control (`voice-panel.tsx`, ~900 lines)
3. **Server Endpoint** — `POST /voice/realtime/session` mints OpenAI Realtime sessions
4. **Den Broker** — `ee/apps/inference/src/voice.ts` charges voice sessions to org usage

## New: TTS (Text-to-Speech)

### Hook (`apps/app/src/react-app/domains/session/voice/use-text-to-speech.ts`)
- Uses Web Speech API's `SpeechSynthesis` (available in Electron/Chromium)
- `speak(text, lang?)` — reads text aloud with optional language matching
- `stop()` — stops current speech
- `speaking` — boolean state
- `supported` — boolean indicating if TTS is available
- Automatic cleanup on unmount (cancels speech)

### UI Integration (`session-surface.tsx`)
- "Read" / "Stop" button in the session surface (top-right corner)
- Reads the last assistant message when clicked
- Stops reading when clicked again
- Only shown when TTS is supported

### i18n
- `tts.read_aloud` — "Read" / "朗读"
- `tts.stop_reading` — "Stop" / "停止"
- Added to all 10 locales (en, zh + 8 others)

## Test Results

### TTS Hook Tests (`use-text-to-speech.test.ts`)
```
bun test src/react-app/domains/session/voice/use-text-to-speech.test.ts
2 pass
0 fail
```

### i18n Completeness
```
6 pass
0 fail
```

### Typecheck
- No TTS-related type errors

## Status: PASSED

## Remaining Voice Gaps (Not in Scope)

- Mobile voice input (requires expo-speech-recognition dependency)
- Standalone ASR/Whisper endpoint for audio file transcription
- Wake-word / always-on listening
- Voice profile / speaker ID