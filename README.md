# E-klase++

A password-protected test host that loads E-klase’s original pages and adds a small ++ tools panel. The primary interface is the original family portal, including its navigation, diary, reports, class rankings, and login screen. The separate personal tools remain available under `/++/`.

No IPA, signing certificate, or sideloading is required. Open the HTTPS test host in Safari and add it to the Home Screen.

## Version 0.2 changes

The incompatible HTML-form login adapter has been removed. The browser now runs the original E-klase client through a narrowly scoped proxy for `family.e-klase.lv` and `auth.e-klase.lv`. The proxy maps authentication redirects, callbacks, public assets, and separate cookie namespaces. It does not guess a password API or transfer an existing browser session.

A real account sign-in must still be tested on the chosen host. Unit tests and a rendered login screen alone do not prove complete account compatibility. Interactive challenges and third-party integrations may require the official site. The app does not bypass them.

## Local setup

Use Node.js 22 or newer. No application dependencies need to be installed.

```sh
npm run setup
npm start
```

Setup creates an ignored `.env` containing a hash of a generated test-site password and a session signing key. It prints the generated password once. Open `http://localhost:3000`, enter that test password, then sign into E-klase using the original login page. Existing configuration is never overwritten automatically.

The local server binds to `127.0.0.1` by default. An iPhone can use the hosted web app, but Safari is not an always-running Node.js server. A backend needs a supported server runtime or HTTPS host.

## Free-host option

The Worker module is compatible with Cloudflare Workers. The repository includes `wrangler.jsonc`.

```sh
npm run check
npm run build
npx wrangler login
npx wrangler secret put APP_PASSWORD_HASH
npx wrangler secret put SESSION_KEY
npx wrangler deploy
```

Use the hash and key from your private `.env`, not the plaintext password, for the two secret values. Cloudflare’s free-plan quotas apply. Running the browser app on the phone does not require keeping another computer on after deployment.

The original managed test deployment uses `.openai/hosting.json`; retain that project ID only for that same deployment. It is not needed for a separate Cloudflare deployment.

## Access model

The test-site password is separate from the E-klase password. A successful unlock creates a signed, HttpOnly access cookie with a seven-day lifetime. HTTPS cookies use Secure and the `__Host-` prefix. The secret values are server configuration and never belong in source control.

The proxy forwards only the two named E-klase origins. App access cookies, hosting identity headers, and unrelated cookies are not forwarded. Authentication and family cookies use separate names on the test host. E-klase permissions, subscriptions, and account boundaries remain controlled by E-klase.

For local development only, `npm run dev` uses a fixed preview password if no configuration is supplied. Use `npm run setup` and `npm start` for your own test instance. Never publish the preview password as production configuration. Rotate both secrets to revoke existing site access sessions.

## Extra tools

- Keep the standard E-klase layout with modest readability and focus improvements.
- Open the floating ++ panel to analyze a visible journal or ranking chart.
- Save a time-stamped copy of visible report data to this device.
- Estimate unlabeled ranking values from percentage bar widths only when visible reference values validate the scale. Estimates are clearly labeled and are not official grades.
- Use personal grade calculations, weighted averages, targets, distribution, median, and CSV exports.
- Add dated notes, pinned remarks, subject tags, tasks, checklists, priorities, and completion states.
- Export plans to Apple Calendar with a 15-minute alert and optional daily or weekly repetition.
- Use the elapsed-time focus timer, custom backgrounds, color controls, density, and optional effects in the personal workspace.
- Export password-encrypted portable backups of personal data and saved report snapshots.

The tools do not edit official grades. Normal actions offered by the original E-klase interface remain actions in that original interface; not every account action has been exercised during development.

## Home Screen and offline behavior

In Safari choose Share → Add to Home Screen → Open as Web App → Add. Unlock the test host, then sign into E-klase. Open Personal Tools once to make that workspace available offline.

Live E-klase HTML, JSON, API responses, login pages, and credentials are never intentionally put in the offline cache. The offline fallback contains only the static personal tools. A live account needs an internet connection. Calendar exports provide reminders while Safari is suspended; the app does not promise background web timers.

## iCloud backups

In Personal Tools → Backups, choose a backup password with at least 12 characters and export the encrypted file. Save to Files → iCloud Drive and verify the file appears there. Restore using the same file and password. The app cannot silently write to iCloud or recover a lost backup password.

Backups use PBKDF2-HMAC-SHA-256 with 310,000 iterations and AES-256-GCM, with random salt and nonce. E-klase passwords, cookies, and login tokens are excluded.

## Tests

```sh
npm run check
```

GitHub Actions runs syntax checks, the synthetic integration and unit tests, and builds a Worker artifact. It does not contain school credentials or perform live account changes.

## License

Original application code is MIT licensed. Historical endpoint research references `makkaX2/eklase-sdk`; the ISC notice is retained in THIRD_PARTY_LICENSES. The original E-klase pages, branding, and resources remain owned by their respective rights holders and are fetched from their original service. This project is independent and is not an official E-klase product.
