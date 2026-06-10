# Cartridge

Cartridge is an offline-first player for tiny, self-contained HTML games and tools.
The hosted page is only a bootstrap: open it once, let it cache the player, then
import cartridge payloads by paste or file and run them locally.

Public player:

`https://aaron-ferber.github.io/cartridge/`

## Model

- The player is a static PWA served from GitHub Pages.
- The service worker caches the player shell after first load.
- Cartridge payloads are imported locally and rendered in a sandboxed iframe.
- Saved cartridges live in the browser's IndexedDB for the installed player.
- There is no backend, no account system, no telemetry, and no payload upload.

## Offline Use

1. Visit the player once while online.
2. Wait for the page to report that it is offline ready.
3. Add it to the Home Screen or bookmark it.
4. Import cartridges by paste or file.
5. Reopen the player later without network.

First contact still needs network because browsers require HTTPS to install a
service worker. After the player has cached, the runtime path is local.

## Repository Layout

```text
docs/        GitHub Pages PWA
player/      Standalone player artifact
cartridges/  Example cartridge payloads
examples/    Notes for example cartridges
test/        Static and offline smoke tests
```

## Development

```bash
npm test
node test/offline-smoke.mjs
```
