# Security Policy

## Client Sandbox Principles

**Browser Mine** is a client-side game engine that executes entirely within the browser's JavaScript / WebGL 2 sandbox:
- **No Remote Telemetry**: World save states and player progress are persisted strictly inside the client's `IndexedDB` and `localStorage`.
- **Zero Third-Party Trackers**: No analytics or ad network scripts are loaded.

## Reporting a Vulnerability

If you identify any security issue (e.g. prototype pollution or cross-origin data exposure):
1. Please do **NOT** open a public issue.
2. Email **linkwithshivang@gmail.com** with the subject line `[SECURITY] Browser Mine Vulnerability`.
3. Provide details and reproduction steps.

All security disclosures are reviewed within 48 hours.
