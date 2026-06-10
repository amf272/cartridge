import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { chromium } from "playwright";

const root = path.resolve(import.meta.dirname, "..");

async function withRunnerPage(callback) {
  const payload = await readFile(path.join(root, "cartridges/runner.html"), "utf8");
  assert.doesNotMatch(payload, /https?:\/\//);

  const browser = await chromium.launch();
  const page = await browser.newPage();

  try {
    await page.setContent(payload, { waitUntil: "domcontentloaded" });
    return await callback(page);
  } finally {
    await browser.close();
  }
}

test("runner jump and tick update state and distance deterministically", async () => {
  await withRunnerPage(async (page) => {
    const apiType = await page.evaluate(
      () => typeof window.__cartridgeRunner?.tick,
    );

    assert.equal(apiType, "function");

    await page.evaluate(() => {
      window.__cartridgeRunner.setState({
        runnerY: 0,
        velocityY: 0,
        distance: 0,
        jumps: 0,
        cleared: 0,
        obstacles: [],
        running: true,
        ended: false,
      });
      window.__cartridgeRunner.jump();
      window.__cartridgeRunner.tick(0.25);
    });

    const state = await page.evaluate(() => window.__cartridgeRunner.getState());

    assert.equal(state.jumps, 1);
    assert.equal(state.distance, 25);
    assert.equal(state.runnerY, 35);
    assert.equal(state.velocityY, 140);
    assert.equal(state.ended, false);
  });
});

test("runner collision shows copyable result card and posts result", async () => {
  await withRunnerPage(async (page) => {
    const messages = [];
    await page.exposeFunction("captureResult", (message) => {
      messages.push(message);
    });
    await page.evaluate(() => {
      window.parent.postMessage = (message) => window.captureResult(message);
      window.__cartridgeRunner.setState({
        runnerY: 0,
        velocityY: 0,
        distance: 420,
        jumps: 12,
        cleared: 9,
        obstacles: [{ x: 74, width: 24, height: 46, counted: false }],
        running: true,
        ended: false,
      });
      window.__cartridgeRunner.tick(0);
    });

    await page.locator("#result:not([hidden])").waitFor();

    const expected = "Runner distance 420 | jumps 12 | cleared 9";
    const cardText = await page.locator(".result-card").textContent();
    const fallbackValue = await page.locator("#copyFallback").inputValue();

    assert.match(cardText, /Crash/);
    assert.match(cardText, /Runner distance 420 \| jumps 12 \| cleared 9/);
    assert.equal(fallbackValue, expected);
    assert.deepEqual(messages, [
      {
        type: "cartridge-result",
        text: expected,
      },
    ]);
  });
});

test("runner keyboard and click input trigger jumps", async () => {
  await withRunnerPage(async (page) => {
    await page.evaluate(() => {
      window.__cartridgeRunner.setState({
        runnerY: 0,
        velocityY: 0,
        distance: 0,
        jumps: 0,
        cleared: 0,
        obstacles: [],
        running: true,
        ended: false,
      });
    });

    await page.keyboard.press("Space");
    let state = await page.evaluate(() => window.__cartridgeRunner.getState());
    assert.equal(state.jumps, 1);
    assert.equal(state.velocityY, 360);

    await page.mouse.click(120, 180);
    state = await page.evaluate(() => window.__cartridgeRunner.getState());
    assert.equal(state.jumps, 2);
    assert.equal(state.velocityY, 360);
  });
});
