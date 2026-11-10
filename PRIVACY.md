# Privacy

The test host loads original E-klase pages through a proxy restricted to the family and authentication service hosts. Your browser runs the original client. Login fields and account requests pass through the HTTPS test backend to E-klase. App code does not intentionally log request bodies, credentials, tokens, or account responses. The hosting operator still controls the code running on that host; use only an instance you trust.

The test-site password is a separate access credential. Its hash is stored in server configuration. A signed HttpOnly cookie records access for seven days; HTTPS uses Secure and the __Host- prefix. No plaintext test password is committed to the repository.

Authentication and family cookies are namespaced separately on the test host and mapped back only for requests to their corresponding original host. The app gate cookie, hosting headers, and unrelated browser cookies are not sent to E-klase. No shared school-data database is created.

Personal grades, notes, plans, goals, images, and saved report snapshots use this device’s IndexedDB. Clicking Save report stores only the supported visible report data. It does not inspect password fields or collect authentication storage. These records are not automatically uploaded to GitHub or synchronized across devices.

The offline cache contains only static personal tools. Live E-klase pages, APIs, JSON, and login responses are excluded. Existing caches from version 0.1 are removed when the new service worker activates.

Backup encryption occurs on the device. Saving to iCloud Drive uploads the encrypted file through Apple Files. E-klase cookies, credentials, and tokens are not included. Restore requires the backup password and explicit confirmation before replacing local data.

E-klase’s own resources, embedded services, account policies, and third-party links remain subject to their respective privacy terms. This project adds no analytics tracker. Hosting providers may keep operational request metadata independently of application logging.
