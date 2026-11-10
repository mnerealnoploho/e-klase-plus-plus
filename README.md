# E-klase++

An independent iPhone Home Screen companion for school planning, personal grade analysis, notes, customization, and encrypted backups. This is a web app, not an IPA. It is not affiliated with E-klase.

## Current status

The personal workspace is implemented and covered by automated tests. Live E-klase authentication is **experimental and not verified**. The current November 2026 login differs from the September public client used as a protocol reference. An unknown interactive login stops with an explicit error. An existing browser login on the official website is not transferred into this application.

The presence of an endpoint in the report picker is not proof that it works in every account. Permissions, subscription, school, and API changes determine availability. The connector never grants additional permissions. Official grades are not editable here.

## Features

- Home Screen installation, mobile navigation, offline application shell, and quick shortcuts.
- Personal 1–10 grades and percentages with separate units, weights, subject averages, distribution, median, goals, CSV export, and target-grade calculations.
- Two-point chart estimation with a stated measurement uncertainty. Estimates are not official grades.
- Tasks with dates, times, priorities, subject tags, remarks, checklists, and completion state.
- Calendar exports with a 15-minute alert and optional daily or weekly recurrence. Add the event to Apple Calendar for alerts while the web app is closed.
- Dated and pinned notes, subject tags, search, text export, and conversion from notes into tasks.
- Focus sessions based on elapsed time, including recovery when returning to the app.
- Dark, light, and system appearance; accent presets; custom colors; density; font size; background images; opacity; blur; optional animation and effects; Reduce Motion support.
- Password-encrypted portable backups, including snapshots and custom images. Save the downloaded file to iCloud Drive through Files.
- Experimental private backend for E-klase login and read-only account operations, with timestamps, JSON exports, saved snapshots, and explicit errors.
- Official E-klase links for messaging, account changes, and unsupported features.

## Run locally

Use Node.js 22 or newer. No third-party runtime dependencies are required.

```sh
npm run check
npm run dev
```

Open `http://localhost:3000`. Local development uses a temporary owner identity and a random session key. Never expose this development server publicly.

An iPhone can run the installed app, but Safari is not a persistent application server. HTTPS hosting is necessary for installation and the live backend. Using the hosted app needs no Mac, signing certificate, or sideloading.

## Build and host

```sh
npm run build
```

The build emits `dist/server/index.js`, a Cloudflare Worker module containing the application assets. The Sites manifest is `.openai/hosting.json`; its identity belongs to the original private Site. A different deployment requires its own project identity.

Configure a secret `SESSION_KEY` with at least 40 random characters in the host’s secret store. Never commit its value. Private hosting supplies `oai-authenticated-user-id`. When deploying elsewhere, implement a trusted authentication boundary that sets this identity itself and strips client-supplied copies. Never set `LOCAL_OWNER` in production.

The GitHub workflow runs syntax checks, unit tests, encryption/restore tests, access-control tests, and builds an artifact. It does not use school credentials or prove live account compatibility.

## Add to Home Screen

Open the hosted private app in Safari and sign into its access gate if asked. Choose Share → Add to Home Screen → Open as Web App → Add. Open it online once to cache the shell. Live account reads still need a working connection.

## Backups and iCloud

Open Backups, choose a password of at least 12 characters, and export the encrypted file. Select Save to Files → iCloud Drive. Check that the file appears there before deleting the app or clearing website data. Restore using the file and its password. There is no password recovery.

Backups use PBKDF2-HMAC-SHA-256 with 310,000 iterations, a random 32-byte salt, and AES-256-GCM with a random 12-byte nonce and authenticated format identification. Passwords and E-klase sessions are excluded. The app cannot silently write or continuously synchronize iCloud backups.

## Testing limits

Unit tests do not establish live E-klase compatibility, physical iPhone behavior, iCloud upload completion, or background push support. iOS can suspend web pages. Calendar exports provide reminders instead of claiming reliable background web timers. Unknown report schemas are shown as safely encoded structured data.

## License and reference

Original application code is MIT licensed. The endpoint catalog and historical protocol research reference [makkaX2/eklase-sdk](https://github.com/makkaX2/eklase-sdk), licensed ISC; its notice is reproduced in THIRD_PARTY_LICENSES. The authentication implementation is independent. It does not execute arbitrary returned scripts or bypass interactive verification.
