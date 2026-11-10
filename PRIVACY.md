# Privacy

Personal grades, plans, notes, goals, images, and saved responses are stored in this device’s IndexedDB. They are not automatically synchronized to a database or uploaded to GitHub. The public repository contains source and synthetic tests only.

When connecting E-klase, credentials pass through this app’s HTTPS backend. It forwards them only to the recognized official authentication origin and does not intentionally store or log them. An unknown login form stops before submission. The current flow is experimental and unverified.

Successful access tokens are encrypted in a Secure, HttpOnly, SameSite=Strict cookie bound to the private host’s authenticated owner. They expire with the upstream session. The password is not stored for automatic reauthentication. Disconnecting removes the app’s E-klase session cookie.

Account responses pass through the backend only on request. They use Cache-Control: no-store and are excluded from service-worker caches. Saving a snapshot stores that response on the device. The application has no analytics trackers. Hosting providers may retain standard operational logs; application code does not log credentials or school data.

Backup encryption happens locally. Choosing iCloud Drive uploads the encrypted file through Apple Files. The app does not receive the backup password. Restore replaces the workspace after the user confirms.

Anyone with access to the unlocked browser profile may access the workspace. Export a backup before clearing site data. The developer cannot recover an encrypted backup password.
