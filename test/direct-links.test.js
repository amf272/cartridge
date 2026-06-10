import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { chromium } from "playwright";

const root = path.resolve(import.meta.dirname, "..");
const docs = path.join(root, "docs");

const types = new Map([
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".svg", "image/svg+xml"],
  [".webmanifest", "application/manifest+json; charset=utf-8"],
]);

function resolveRequest(url) {
  const parsed = new URL(url, "http://localhost");
  let pathname = parsed.pathname;
  if (!pathname.startsWith("/cartridge/")) return null;
  pathname = pathname.slice("/cartridge/".length);
  if (!pathname || pathname.endsWith("/")) pathname += "index.html";
  const target = path.normalize(path.join(docs, pathname));
  if (!target.startsWith(docs)) return null;
  return target;
}

async function withStaticServer(callback) {
  const server = createServer(async (request, response) => {
    const file = resolveRequest(request.url || "/");
    if (!file || !existsSync(file)) {
      response.writeHead(404);
      response.end("not found");
      return;
    }
    const body = await readFile(file);
    response.writeHead(200, {
      "content-type": types.get(path.extname(file)) || "application/octet-stream",
      "cache-control": "no-store",
    });
    response.end(body);
  });

  await new Promise((resolve) => server.listen(0, "localhost", resolve));
  const { port } = server.address();

  try {
    return await callback(`http://localhost:${port}/cartridge/`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

async function withPage(pathname, callback, contextOptions = {}) {
  await withStaticServer(async (baseUrl) => {
    const browser = await chromium.launch();
    const context = await browser.newContext({
      serviceWorkers: "allow",
      ...contextOptions,
    });
    const page = await context.newPage();

    try {
      await page.goto(new URL(pathname, baseUrl).href, {
        waitUntil: "domcontentloaded",
      });
      return await callback(page);
    } finally {
      await context.close();
      await browser.close();
    }
  });
}

test("?example=snake launches Snake in the iframe", async () => {
  await withPage("?example=snake", async (page) => {
    await page.frameLocator("#frame").locator("h1", { hasText: "Snake" }).waitFor();
    assert.equal(await page.locator("#currentName").textContent(), "Snake");
  });
});

test("?game=2048 launches 2048 in the iframe", async () => {
  await withPage("?game=2048", async (page) => {
    await page
      .frameLocator("#frame")
      .locator("text=Join matching tiles to reach 2048.")
      .waitFor();
    assert.equal(await page.locator("#currentName").textContent(), "2048");
  });
});

test("?example=2048 launches even when service worker registration is blocked", async () => {
  await withPage(
    "?example=2048",
    async (page) => {
      await page
        .frameLocator("#frame")
        .locator("text=Join matching tiles to reach 2048.")
        .waitFor();
      assert.equal(await page.locator("#currentName").textContent(), "2048");
    },
    { serviceWorkers: "block" },
  );
});

test("?example=who-said-it launches Who Said It? in the iframe", async () => {
  await withPage("?example=who-said-it", async (page) => {
    await page
      .frameLocator("#frame")
      .locator("h1", { hasText: "Who Said It?" })
      .waitFor();
    assert.equal(await page.locator("#currentName").textContent(), "Who Said It?");
  });
});

test("?example=swipe-decks accepts a custom deck query parameter", async () => {
  const deck = [
    {
      id: "canal",
      name: "Canal Walk",
      text: "Quiet loop by the water.",
      tags: ["outside", "calm"],
    },
    {
      name: "Noodle Counter",
      text: "Fast seat, loud kitchen.",
      tags: "food",
    },
  ];
  const deckParam = Buffer.from(JSON.stringify(deck), "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");

  await withPage(`?example=swipe-decks&deck=${deckParam}`, async (page) => {
    const frame = page.frameLocator("#frame");
    await frame.locator("#name", { hasText: "Canal Walk" }).waitFor();
    assert.equal(await page.locator("#currentName").textContent(), "Swipe Decks");

    await frame.locator("#like").click();
    await frame.locator("#pass").click();
    await frame.locator("#resultText", { hasText: "top Canal Walk" }).waitFor();
  });
});

test("#cart payload takes precedence over ?example=snake", async () => {
  const payload = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>Direct Hash Payload</title></head>
<body><h1>Direct Hash Payload</h1></body>
</html>`;

  await withPage(`?example=snake#cart=${encodeURIComponent(payload)}`, async (page) => {
    await page
      .frameLocator("#frame")
      .locator("h1", { hasText: "Direct Hash Payload" })
      .waitFor();
    assert.equal(
      await page.locator("#currentName").textContent(),
      "Direct Hash Payload",
    );
  });
});
