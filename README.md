# Cartridge

Cartridge is an offline-first player for tiny, self-contained HTML games and tools.
The hosted page is only a bootstrap: open it once, let it cache the player, then
import cartridge payloads by paste or file and run them locally.

Public player:

`https://aaron-ferber.github.io/cartridge/`

Source repo:

`https://github.com/amf272/cartridge`

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

## QR Workflow

The Home Screen workflow is in-app scanning:

1. Open the saved Cartridge Player.
2. Tap `Scan`.
3. Grant camera access.
4. Scan a QR containing cartridge text.
5. Run and save the scanned cartridge locally.

The preferred QR payload format is:

```text
cart:v1:base64url:<utf8-html-payload>
```

The player also accepts hosted cartridge links shaped like:

```text
https://aaron-ferber.github.io/cartridge/#cart=<encoded-html-payload>
```

Use the `cart:v1` format for offline handoff. Use file import or AirDrop for
larger cartridges; QR codes are best for small payloads.

## Repository Layout

```text
docs/        GitHub Pages PWA
player/      Standalone player artifact
cartridges/  Example cartridge payloads
examples/    Notes for example cartridges
test/        Static and offline smoke tests
```

See `SPEC.md` for the runtime contract and `IDEAS.md` for cartridge game
directions.

## Development

```bash
npm test
node test/offline-smoke.mjs
```
