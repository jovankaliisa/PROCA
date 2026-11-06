# PROCA Admin Dashboard — Module 01

Next.js App Router + Tailwind CSS v4 + Supabase SSR.

## Included

- PROCA dark cyber-tech responsive dashboard with light/dark toggle.
- School-scoped overview metrics.
- Navigation for overview, app whitelisting, content filtering, student management, and device branding.
- Supabase browser/server clients using `@supabase/ssr`.
- Session refresh proxy using `auth.getClaims()`.
- Realtime subscription to school-filtered `device_policies` changes.
- Policy editor UI scaffold. Controls intentionally remain disabled until a device and its policy exist.

## Setup

1. Copy `.env.example` to `.env.local`.
2. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
3. Run `npm install`.
4. Run `npm run dev`.

## Important implementation notes

- The browser only receives the Supabase publishable key. Never put a service-role or secret key in `NEXT_PUBLIC_*`.
- RLS is the authorization boundary. The dashboard filters queries by school for clarity, but database policies enforce access.
- Device policies are per-device in the current schema. The dashboard does not invent a device or write a policy without an enrolled device.
- The Windows agent must not use an administrator publishable key as device authentication. Implement a separate enrollment credential exchange and server-side policy endpoint before agent deployment.
- Do not enable destructive Windows lockdown behavior (custom shell, hotkey suppression, process termination) until device recovery, signed policy validation, offline-safe rollback, and admin break-glass paths are implemented.
- The student directory, domain editor, app rule editor, and branding upload workflow are UI placeholders for subsequent implementation phases.

## Authentication setup

- Email/password sign-in uses Supabase Auth.
- Microsoft sign-in uses the Supabase `azure` OAuth provider. Configure Microsoft Entra ID as an Azure provider in Supabase Auth and add the local and production callback URLs to the provider configuration.
- Add `/auth/callback` to the allowed redirect URLs in Supabase Auth.
- Configure the Microsoft provider's client ID and secret in Supabase Dashboard; never put the secret in browser environment variables.

## Repository integration

This is a generated starter package, not a commit to the GitHub repository. Inspect the current repository structure before merging these files.
