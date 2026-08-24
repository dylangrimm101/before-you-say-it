# Provider evidence

Revision: `c4ff389158bee97dcd5d602aee5cad4db735364e`

No secret, transcript body, generated audio, or recording is included.

## TTS smoke test

- Endpoint: `POST https://beforeyousayit.app/api/tts`
- Role: `adam`
- Status: 200
- Content type: `audio/mpeg`
- Byte length: 57,095
- Generated audio retained: no

## Transcription and device-only gaps

The protected transcription endpoint and upload behavior are covered by passing static tests, but no real recording request was available. Playback started/completed, microphone exclusion during playback, runtime transcript/TTS identity, and a second post-TTS recording remain blocked pending real-device proof.
