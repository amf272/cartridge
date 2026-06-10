# Cartridge Remote Handoff

## Immediate Context

This repo is the standalone source for the offline-first Cartridge Player.
The public player is deployed at:

```text
https://aaron-ferber.github.io/cartridge/
```

The source repo is:

```text
https://github.com/amf272/cartridge
```

The deployment mirror is:

```text
aaron-ferber/aaron-ferber.github.io, isolated under /cartridge/
```

## Current Player

The player is a static PWA in `docs/`.

- Service worker caches the player shell.
- Payloads run in a sandboxed iframe.
- Payloads can be pasted, imported by file, opened from `#cart=`, or scanned
  through the in-app QR scanner.
- QR format:

```text
cart:v1:base64url:<utf8-html-payload>
```

- Saved cartridges live in IndexedDB.
- No backend, accounts, sync, telemetry, or server-side payload storage.

## Verification

Use these before claiming anything works:

```bash
npm test
node test/offline-smoke.mjs
```

The offline smoke starts a local HTTP server, installs the service worker, goes
offline, and verifies bundled example cartridges still run.

## Current Built-In Examples

`docs/examples.js` currently bundles:

- `StoopSwipe`
- `Lunch Special Radar`
- `Last Call`

These are examples of the desired shape: quick, playful, offline, and easy to
share by result card.

## Game Backlog

The current wanted list lives in:

```text
GAMES.md
IDEAS.md
```

Build order should start with the infinite arcade family:

1. `2048`
2. `Snake`
3. `Tetris`
4. `Minesweeper`
5. `One-tap runner`

All games should be self-contained cartridge payloads. Prefer small HTML files
that can be pasted, imported, or encoded into QR payloads when small enough.
Each game should end with a compact score/result card that can be copied back
into chat.

## Product Direction

Keep the work concrete, local, social, and demoable. Avoid generic productivity
apps. The strongest direction so far is a cartridge player plus a library of
fun, bite-sized games and NYC-flavored guessing/swipe games.

## Useful Files

- `README.md`: public overview and QR workflow.
- `SPEC.md`: runtime contract.
- `IDEAS.md`: initial idea list and arcade-family note.
- `GAMES.md`: consolidated wanted game list.
- `docs/app.js`: player runtime, import, QR scan, shelf.
- `docs/payloads.js`: cartridge input parser.
- `docs/examples.js`: bundled example cartridges.
- `test/payloads.test.js`: parser tests.
- `test/pwa-files.test.js`: PWA structure tests.
- `test/offline-smoke.mjs`: browser offline smoke.

## Remote Session Task

Orient on the repo, run the verification commands, then start implementing the
game backlog as cartridge payloads. Recommended first app: `2048`, because it is
small, swipe-native, and demonstrates the offline cartridge format cleanly.
