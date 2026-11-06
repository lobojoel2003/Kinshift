# Security policy

Kinshift stores sensitive health information about real families, so security
reports are taken seriously and handled quickly.

## Supported versions

Security fixes are released for the latest minor version. Run the newest
release, and pull the `latest` (or `1`) Docker tag to stay current.

| Version | Supported |
| ------- | --------- |
| 1.x     | ✅        |
| < 1.0   | ❌        |

## Reporting a vulnerability

Please **do not open a public issue**. Instead, use
[GitHub private vulnerability reporting](https://github.com/lobojoel2003/Kinshift/security/advisories/new).

Include what you found, how to reproduce it and the version you tested. You can
expect an acknowledgement within 3 days and a fix or mitigation plan within 14
days for confirmed issues. Credit is given in the release notes unless you
prefer otherwise.

## How Kinshift protects data

- **Encryption at rest.** Medication details, appointment details, journal
  entries, vitals, tasks, the care profile, shift notes and the activity log are
  encrypted with AES-256-GCM. Every circle has its own random data key, which is
  wrapped with a key derived (HKDF-SHA256) from `KINSHIFT_SECRET`. Ciphertexts
  are bound to their circle and field, so they cannot be swapped between rows.
- **Passwords** are hashed with scrypt (N=2¹⁵, r=8, p=1) and a random salt.
- **Sessions** are 256-bit random tokens in `HttpOnly`, `SameSite=Lax` cookies
  (`Secure` over HTTPS). Only a SHA-256 hash of each token is stored. Sessions
  expire after 30 days of inactivity and can be revoked from account settings.
- **Invite links** are single-purpose random tokens, stored hashed, that expire
  after 7 days and a limited number of uses, and can be revoked.
- **Authorization** is checked on the server in every page and Server Action
  (owner, caregiver and viewer roles). Server Actions have built-in CSRF
  protection.
- **Headers.** A per-request nonce-based Content Security Policy, HSTS over
  HTTPS, `X-Frame-Options: DENY`, `nosniff` and a strict referrer policy.
- **Rate limiting** on sign-in, sign-up and password changes.
- **Push notifications** are end-to-end encrypted by the Web Push protocol and
  use discreet wording by default, so no medication names show on lock screens.
- **No telemetry.** Kinshift makes no outbound requests except push
  notifications you enable.

## Operator responsibilities

Whoever runs the server can read the data, the same as any self-hosted app.
Please:

1. Serve Kinshift over HTTPS.
2. Set `KINSHIFT_SECRET` and keep a copy **separate** from database backups.
3. Back up the `/data` volume regularly.
4. Keep the image up to date.
