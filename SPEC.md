# Cartridge Specification

## Goal

Cartridge provides a small offline-first player for self-contained HTML/JS
payloads called cartridges. The public web surface helps a person obtain and
cache the player; cartridge execution should not depend on a server after that.

## Distribution Posture

The project uses a public GitHub repository and GitHub Pages project site:

- Source repository: `amf272/cartridge`
- Deployment mirror: `aaron-ferber/aaron-ferber.github.io`, isolated under
  `/cartridge/`
- Pages URL: `https://aaron-ferber.github.io/cartridge/`

This intentionally replaces the earlier no-hosting constraint with a narrower
rule: the player shell may be publicly hosted, but cartridge payloads should not
be uploaded to a server during normal use.

## Runtime Requirements

- The hosted page must register a service worker from the same origin.
- The service worker must cache the player shell for offline launch.
- The player must accept cartridge payloads by paste and by local file.
- The player must store saved cartridges locally.
- The player must execute cartridge HTML inside a sandboxed iframe.
- The player must not require an account, backend API, analytics service, or
  remote asset after installation.

## Non-Goals

- Native App Store distribution.
- Server-side cartridge storage.
- Multi-user sync.
- Trusting arbitrary cartridge code beyond iframe sandboxing.

## First-Contact Limitation

A PWA cannot be installed or cached before a first online visit. The practical
promise is: online once for the player bootstrap, then local/offline for player
launch and cartridge execution.
