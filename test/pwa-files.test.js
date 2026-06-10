import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");

const docsFiles = [
  "docs/index.html",
  "docs/app.js",
  "docs/examples.js",
  "docs/payloads.js",
  "docs/styles.css",
  "docs/sw.js",
  "docs/lib/jsQR.js",
  "docs/manifest.webmanifest",
  "docs/icon.svg",
];

async function text(file) {
  return readFile(path.join(root, file), "utf8");
}

test("PWA app shell files exist", () => {
  for (const file of docsFiles) {
    assert.equal(
      existsSync(path.join(root, file)),
      true,
      `${file} should exist`,
    );
  }
});

test("manifest is scoped to the GitHub Pages project path", async () => {
  const manifest = JSON.parse(await text("docs/manifest.webmanifest"));

  assert.equal(manifest.name, "Cartridge Player");
  assert.equal(manifest.short_name, "Cartridge");
  assert.equal(manifest.start_url, "/cartridge/");
  assert.equal(manifest.scope, "/cartridge/");
  assert.equal(manifest.display, "standalone");
  assert.ok(manifest.icons.every((icon) => !icon.src.startsWith("http")));
});

test("service worker precaches the offline app shell", async () => {
  const sw = await text("docs/sw.js");
  const requiredAssets = [
    "./",
    "./index.html",
    "./styles.css",
    "./app.js",
    "./payloads.js",
    "./examples.js",
    "./lib/jsQR.js",
    "./manifest.webmanifest",
    "./icon.svg",
  ];

  assert.match(sw, /const CORE_ASSETS = \[/);
  for (const asset of requiredAssets) {
    assert.match(
      sw,
      new RegExp(JSON.stringify(asset).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
    );
  }
  assert.match(sw, /caches\.open/);
  assert.match(sw, /fetch/);
});

test("player registers its service worker and uses local-only app assets", async () => {
  const index = await text("docs/index.html");
  const app = await text("docs/app.js");

  assert.match(index, /rel="manifest" href="\.\/manifest\.webmanifest"/);
  assert.match(index, /src="\.\/lib\/jsQR\.js"/);
  assert.match(index, /src="\.\/app\.js"/);
  assert.match(app, /navigator\.serviceWorker\.register\("\.\/sw\.js"/);
  assert.match(app, /indexedDB\.open\("cartridge-player"/);
  assert.match(
    app,
    /setAttribute\("sandbox", "allow-scripts allow-forms allow-modals"\)/,
  );
});

test("player exposes an offline QR scan workflow", async () => {
  const index = await text("docs/index.html");
  const app = await text("docs/app.js");

  assert.match(index, /id="scanButton"/);
  assert.match(index, /id="scannerPanel"/);
  assert.match(app, /navigator\.mediaDevices\.getUserMedia/);
  assert.match(app, /window\.jsQR/);
  assert.match(app, /parseCartridgeInput/);
});

test("player bundles salient example cartridges", async () => {
  const examples = await text("docs/examples.js");

  assert.match(examples, /StoopSwipe/);
  assert.match(examples, /Lunch Special Radar/);
  assert.match(examples, /Last Call/);
});

test("first-party PWA files do not depend on remote URLs", async () => {
  for (const file of docsFiles) {
    const content = (await text(file)).replace(
      "http://www.w3.org/2000/svg",
      "",
    );
    assert.doesNotMatch(
      content,
      /https?:\/\//,
      `${file} should not reference remote URLs`,
    );
  }
});
