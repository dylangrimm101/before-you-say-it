# Before You Say It

AI-guided communication practice.

## Repository status

- `expo/` is the canonical Before You Say It application and the only implementation that should receive product changes.
- `ios/` is a frozen historical Swift implementation retained for reference. Product changes must not be mirrored into it.
- Both implementations currently use the same iOS bundle identifier. Do not build or submit either implementation until the intended implementation has been explicitly confirmed.
- EAS Build and EAS Update are not configured.
- Any build, deployment, update, or store submission requires separate explicit approval.

## Development

The workspace apps are registered in `rork.json`. Run Expo commands from `expo/`:

```bash
cd expo
bun install
bun test
```

Do not commit local environment files, generated native Expo projects, signing material, credentials, or build outputs.
