@AGENTS.md

## Claude Code notes

- Read `README.md` before changing sign-up/reset flows; it documents the reCAPTCHA limitation, redirect-URL setup and "Keep me signed in" behaviour.
- This is the SDK 54 / Firebase sibling of `../loginpage-newdeploy` (SDK 57 / Vercel), which is the more up-to-date copy of the shared auth code. When fixing shared logic, check whether the other repo needs the same fix and say so rather than silently editing it.
- The `.agents/skills/` Firebase skills are vendored docs. Use them only if the task actually involves Firebase (hosting or analytics); don't edit them.
- `.mcp.json` registers the `lance` MCP server (App Store Connect operator); unrelated to normal app work.
- Don't open or echo `.env`, `google-services.json` or `GoogleService-Info.plist`.
