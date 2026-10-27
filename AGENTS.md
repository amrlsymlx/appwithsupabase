# Auth App with Supabase (appwithsupabase)

Cross-platform (iOS / Android / web) auth + dashboard app: Expo Router + Supabase Auth, no custom backend. Same product as `../loginpage-newdeploy` (sign up with email verification, sign in, forgot/reset password, profile + avatar upload, themeable dashboard with drawer) but on an older Expo baseline, with **Firebase** for hosting and analytics instead of Vercel. App name "TestApp", package name `vcode`, URL scheme `vcode://`, bundle/package id `com.anonymous.TestApp`.

## Expo has changed

Your training data is out of date. This project is on **Expo SDK 54** (React Native 0.81, React 19.1, TypeScript 5.9, `typedRoutes` + React Compiler enabled). Read the exact versioned docs before writing Expo, Expo Router or React Native code: https://docs.expo.dev/versions/v54.0.0/

## Commands

- `npm start` – dev server (`npx expo start --clear` after changing any `EXPO_PUBLIC_*` value)
- `npm run web` – web; `npm run android` / `npm run ios` – **native dev builds** (`expo run:*`; Firebase native modules mean Expo Go will not work)
- `npm run predeploy` – static web export (`expo export -p web`) to `dist/`
- `npm run deploy-hosting` – export, then `firebase deploy --only hosting`
- `npm run lint` – `expo lint`; run after changes and fix what you introduced

There is no test suite.

## Layout

- `app/` – `index.tsx` (sign in + email-verification deep-link handler), `sign-up.tsx`, `forgot-password.tsx`, `reset-password.tsx`, `dashboard/` (`_layout.tsx` = session guard + drawer + tabs, `index`, `create`, `settings`, `edit-profile`). `app/(tabs)/` is an empty leftover directory.
- `components/` – `Captcha.tsx` (reCAPTCHA v2: web component / native WebView), `PasswordChecklist.tsx`, `dashboard/` (Drawer/Profile contexts, avatar geometry)
- `lib/` – `supabase.ts` (client singleton, no native AppState refresh hook here, unlike the sibling repo), `authStorage.ts` (SecureStore/localStorage adapter), `storage.ts`, `profile.ts`, `authRedirect.ts`, `avatarLibrary.ts`, `validation.ts`, `theme.tsx`, `formStyles.ts`, and analytics split by platform: `analytics.native.ts` (`@react-native-firebase/analytics`), `analytics.web.ts` (Firebase JS SDK), `analytics.d.ts`
- `docs/supabase-storage-setup.md` – `avatars` bucket and policy setup
- `firebase.json` / `.firebaserc` – Hosting config (`public: dist`, clean URLs, trailing-slash redirects). `google-services.json` and `GoogleService-Info.plist` are the native Firebase configs.
- `.agents/skills/` and `skills-lock.json` – vendored Firebase agent skills (Auth, Firestore, Hosting, Data Connect, etc.). Reference material only; this app does not use Firestore or Firebase Auth.

## Rules

1. **Cross-platform first.** Browser-only and native-only code goes in platform-suffixed files (`.web.ts` / `.native.ts`), following the `analytics` pattern.
2. **Supabase is the only auth/data backend.** Firebase here means Hosting + Analytics only. Don't add Firebase Auth/Firestore usage.
3. **Never trust a cached profile for access.** `dashboard/_layout.tsx` re-validates against the live Supabase session; keep the `SIGNED_OUT` → `/` bounce.
4. **"Remember me" (pre-fills the form) and "Keep me signed in" (where the refresh token lives) are separate.** Don't merge them. Passwords are never stored on-device.
5. **reCAPTCHA is a client-side UI gate only**; the token is deliberately not sent to Supabase. Don't present it as a security boundary.
6. **Don't use `Alert.alert` for messages that must show on web**; react-native-web's version is a no-op. (The sibling repo has `lib/notify.ts`; this one doesn't yet, so add an equivalent rather than relying on `Alert`.)
7. **Match existing code, keep TypeScript strict, keep changes small.** Use `npx expo install <pkg>` so versions match SDK 54.

## Environment and secrets

`.env` (git-ignored; never commit or print values): `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_RECAPTCHA_SITE_KEY`, `EXPO_PUBLIC_APP_BASE_URL`, plus optional `EXPO_PUBLIC_SIGNUP_REDIRECT_URL`, `EXPO_PUBLIC_RESET_REDIRECT_URL`, `EXPO_PUBLIC_RECAPTCHA_BASE_URL`, `EXPO_PUBLIC_RECOVERY_LINK_BLOCK_HOURS`. Several commented domain blocks exist (Firebase / own domain / localhost); keep exactly one active, and keep Supabase Site URL and redirect allow-list in sync with it.

- Only the public Supabase anon key belongs in client code; rely on RLS and Storage policies.
- The `avatars` bucket is private; avatars are read via signed URLs.
- Post-reset confirmation email comes from the Supabase Edge Function `send-password-change-success-email`, which is not in this repo.
- `lib/analytics.web.ts` embeds the Firebase **web** config. Those values are public client identifiers by design, but don't add any secret or service-account key to the repo.
- Static export: do **not** enable SPA rewrites in Firebase Hosting.

## Git

- Don't commit or push unless asked. Short, imperative commit messages.
