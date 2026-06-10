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

- `2048`
- `Snake`
- `One-tap Runner`
- `Minesweeper`
- `Tetris`
- `Swipe Decks`
- `Rentle`
- `Price Is Wrong`
- `Payroll Tab`
- `Chargemaster Roulette`
- `Menus of New York`
- `Hydrant Index: Jackpot`
- `Who Said It?`
- `Group Table`
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

The original requested list is implemented and bundled:

1. `2048`
2. `Snake`
3. `Tetris`
4. `Minesweeper`
5. `One-tap runner`
6. `Rentle`
7. `Price Is Wrong`
8. `Payroll Tab`
9. `Chargemaster Roulette`
10. `Menus of New York`
11. `Hydrant Index: Jackpot`
12. `Who Said It?`
13. `Swipe Decks`
14. `Group Table`

All games should be self-contained cartridge payloads. Prefer small HTML files
that can be pasted, imported, or encoded into QR payloads when small enough.
Each game should end with a compact score/result card that can be copied back
into chat.

Next work should focus on polish, visual QA, richer seed decks, and any new
cartridge concepts Aaron adds to `GAMES.md`.

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

Orient on the repo, run the verification commands, then continue polish or add
new cartridge payloads. The original 14-game backlog is now implemented as
bundled offline examples.
