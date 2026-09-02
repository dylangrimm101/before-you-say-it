# Backend and commerce launch QA

## Scope

Security, environment handling, provider configuration, and paywall disclosure corrections on `fix/backend-commerce` from baseline `18a7085`.

## Implemented

- Supabase transcription now requires both gateway JWT verification and an explicit Supabase Auth `/auth/v1/user` verification before reading an upload.
- The Expo transcription client sends the current authenticated session access token rather than treating the public anon key as user authorization.
- The client accepts a transcription destination only when it matches the configured Supabase origin and exact function path, preventing session-token exfiltration through a bad endpoint setting.
- Multipart requests are consumed through a bounded stream before parsing; the total request and extracted audio file are independently size-limited.
- Transcription uses a short-window per-instance limiter plus a required distributed rate-limit hook. Missing, malformed, or unreachable distributed rate limiting fails closed.
- Browser origins are restricted by `TRANSCRIBE_ALLOWED_ORIGINS`; wildcard CORS was removed. Originless native requests remain subject to authentication and both rate limits.
- Babel, Metro, and ESLint run client environment preflight before loading client configuration. The public generate, transcribe, and TTS endpoint variables are explicitly approved; private and unknown secret-like variables remain removed/rejected.
- AI generation and TTS no longer silently assume production URLs. Each requires an explicit HTTPS endpoint with the expected `/api/generate` or `/api/tts` path and fails clearly when missing or malformed. Test-only endpoint fixtures live in Bun's test preload and are not production defaults.
- Every visible paywall price now comes from RevenueCat/storefront product data. Hard-coded dollar prices and the unimplemented three-day reminder-email promise were removed.
- The paywall now links native users directly to Apple or Google subscription management for cancellation and explains renewal/cancellation without implying an app-owned reminder.
- Product IDs, prices, trial requirements, and entitlement logic were not changed.

## Required runtime configuration

Client build:

- `EXPO_PUBLIC_GENERATE_ENDPOINT` — HTTPS URL ending in `/api/generate`
- `EXPO_PUBLIC_TTS_ENDPOINT` — HTTPS URL ending in `/api/tts`
- `EXPO_PUBLIC_TRANSCRIBE_ENDPOINT`, or `EXPO_PUBLIC_SUPABASE_URL` for the derived function URL
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`

Transcription function:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `OPENAI_API_KEY`
- `TRANSCRIBE_RATE_LIMIT_URL` — HTTPS distributed limiter hook
- `TRANSCRIBE_RATE_LIMIT_SECRET`
- `TRANSCRIBE_ALLOWED_ORIGINS` — comma-separated browser origin allowlist (may be empty for native-only use)
- Optional: `OPENAI_TRANSCRIBE_MODEL`

The distributed limiter must accept `POST { subject, action: "transcribe" }`, authenticate the bearer hook secret, and return JSON containing boolean `allowed` plus optional numeric `retryAfterSeconds`; it may also return HTTP 429 with `Retry-After`.

## Verification

- Focused transcription security tests: **9 passed, 0 failed**.
- Full Bun suite: **809 passed, 0 failed, 7,904 assertions across 51 files**.
- TypeScript + lint check: **passed** (one pre-existing `react-hooks/exhaustive-deps` warning in `app/approved-lesson/[lessonId].tsx`).
- Standalone lint: **passed** with the same pre-existing warning and zero errors.
- Expo export: **passed** for web, Android, and iOS.
- Backend Deno type check: **passed** for transcription and Stripe webhook functions.
- `git diff --check`: **passed**.
- Independent read-only Codex review: **APPROVED** after endpoint-origin pinning and a distributed-limiter timeout were verified.

## Unexercised external boundaries

- No deployment was performed, as required.
- Supabase CLI is unavailable locally, so `supabase functions serve` was not run.
- No live provider, Supabase Auth, distributed limiter, RevenueCat storefront, purchase, or cancellation-link device flow was exercised because this worktree has no production credentials/configuration and the task prohibits deployment. These remain environment/device acceptance checks after the required configuration is supplied.
