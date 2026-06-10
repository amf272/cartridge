import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { chromium } from "playwright";

const root = path.resolve(import.meta.dirname, "..");

async function withHydrantPage(callback) {
  const payload = await readFile(
    path.join(root, "cartridges/hydrant_index.html"),
    "utf8",
  );
  const browser = await chromium.launch();
  const page = await browser.newPage();

  try {
    await page.setContent(payload, { waitUntil: "domcontentloaded" });
    return await callback(page, payload);
  } finally {
    await browser.close();
  }
}

test("Hydrant Index payload is self-contained without remote URLs", async () => {
  const payload = await readFile(
    path.join(root, "cartridges/hydrant_index.html"),
    "utf8",
  );

  assert.doesNotMatch(payload, /https?:\/\//i);
});

test("Hydrant Index scores numeric guesses by percent miss", async () => {
  await withHydrantPage(async (page) => {
    const result = await page.evaluate(() => {
      window.__cartridgeHydrantIndex.setState({
        deck: [
          {
            corner: "W 14th St & 8th Ave",
            neighborhood: "Chelsea",
            clue: "Nightlife block, narrow curb, heavy rideshare turnover.",
            tickets: 400,
          },
        ],
        round: 0,
        history: [],
        score: 0,
        revealed: false,
      });
      return window.__cartridgeHydrantIndex.submitGuess(300);
    });

    const state = await page.evaluate(() =>
      window.__cartridgeHydrantIndex.getState(),
    );

    assert.deepEqual(result, {
      answer: 400,
      direction: "low",
      guess: 300,
      missPct: 25,
      points: 75,
    });
    assert.equal(state.score, 75);
    assert.equal(state.revealed, true);
    assert.equal(state.history.length, 1);
  });
});

test("Hydrant Index revealAnswer reveals once, then advances rounds", async () => {
  await withHydrantPage(async (page) => {
    const snapshots = await page.evaluate(() => {
      window.__cartridgeHydrantIndex.setState({
        deck: [
          {
            corner: "N 7th St & Bedford Ave",
            neighborhood: "Williamsburg",
            clue: "Weekend retail strip near the subway.",
            tickets: 520,
          },
          {
            corner: "Court St & Atlantic Ave",
            neighborhood: "Boerum Hill",
            clue: "School-day loading pressure beside a bus lane.",
            tickets: 280,
          },
        ],
        round: 0,
        history: [],
        score: 0,
        revealed: false,
      });

      window.__cartridgeHydrantIndex.revealAnswer();
      const revealed = window.__cartridgeHydrantIndex.getState();
      window.__cartridgeHydrantIndex.revealAnswer();
      const advanced = window.__cartridgeHydrantIndex.getState();
      return { revealed, advanced };
    });

    assert.equal(snapshots.revealed.revealed, true);
    assert.equal(snapshots.revealed.round, 0);
    assert.deepEqual(snapshots.revealed.history, [
      {
        answer: 520,
        direction: "revealed",
        guess: null,
        missPct: 100,
        points: 0,
      },
    ]);
    assert.equal(snapshots.advanced.revealed, false);
    assert.equal(snapshots.advanced.round, 1);
    assert.equal(snapshots.advanced.history.length, 1);
  });
});

test("Hydrant Index renders final result card and posts message", async () => {
  await withHydrantPage(async (page) => {
    const messages = [];
    await page.exposeFunction("captureResult", (message) => {
      messages.push(message);
    });

    await page.evaluate(() => {
      window.parent.postMessage = (message) => window.captureResult(message);
      window.__cartridgeHydrantIndex.setState({
        history: [
          { missPct: 20, points: 80 },
          { missPct: 40, points: 60 },
          { missPct: 10, points: 90 },
          { missPct: 30, points: 70 },
          { missPct: 50, points: 50 },
        ],
        score: 350,
      });
      window.__cartridgeHydrantIndex.finishGame("Hydrant haul complete");
    });

    await page.locator("#result:not([hidden])").waitFor();

    const expected = "Hydrant Index score 350 | avg miss 30% | rounds 5";
    const resultText = await page.locator("#resultText").textContent();
    const fallbackValue = await page.locator("#copyFallback").inputValue();
    const cardText = await page.locator(".result-card").textContent();

    assert.equal(resultText, expected);
    assert.equal(fallbackValue, expected);
    assert.match(cardText, /Hydrant haul complete/);
    assert.deepEqual(messages, [{ type: "cartridge-result", text: expected }]);
  });
});
