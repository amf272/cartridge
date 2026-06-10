import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const root = path.resolve(import.meta.dirname, "..");
const docs = path.join(root, "docs");

const types = new Map([
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".svg", "image/svg+xml"],
  [".webmanifest", "application/manifest+json; charset=utf-8"]
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
    "cache-control": "no-store"
  });
  response.end(body);
});

await new Promise((resolve) => server.listen(0, "localhost", resolve));
const { port } = server.address();
const url = `http://localhost:${port}/cartridge/`;

const browser = await chromium.launch();
const context = await browser.newContext({ serviceWorkers: "allow" });
const page = await context.newPage();

try {
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#status.ready", { timeout: 10000 });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector("#status.ready", { timeout: 10000 });

  await context.setOffline(true);
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("h1", { timeout: 10000 });
  const title = await page.locator("h1").textContent();
  if (title !== "Cartridge Player") {
    throw new Error(`expected Cartridge Player title, got ${title}`);
  }

  await page.click("#sampleButton");
  await page.frameLocator("#frame").locator("text=Local cartridge").waitFor({ timeout: 10000 });
  console.log("offline smoke passed");
} finally {
  await context.close();
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
