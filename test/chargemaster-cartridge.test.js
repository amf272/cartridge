import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { chromium } from "playwright";

const root = path.resolve(import.meta.dirname, "..");

async function withChargemasterPage(callback) {
  const payload = await readFile(
    path.join(root, "cartridges/chargemaster_roulette.html"),
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

test("Chargemaster payload is self-contained without remote URLs", async () => {
  const payload = await readFile(
    path.join(root, "cartridges/chargemaster_roulette.html"),
    "utf8",
  );

  assert.doesNotMatch(payload, /https?:\/\//i);
});

test("Chargemaster scores numeric guesses by percent miss", async () => {
  await withChargemasterPage(async (page) => {
    const result = await page.evaluate(() => {
      window.__cartridgeChargemaster.setState({
        deck: [
          {
            hospital: "North Loop Medical Center",
            city: "Chicago, IL",
            procedure: "MRI lower back without contrast",
            clue: "Academic hospital, central business district.",
            price: 1000,
          },
        ],
        round: 0,
        history: [],
        score: 0,
        revealed: false,
      });
      return window.__cartridgeChargemaster.submitGuess(1250);
    });

    const state = await page.evaluate(() =>
      window.__cartridgeChargemaster.getState(),
    );

    assert.deepEqual(result, {
      answer: 1000,
      direction: "high",
      guess: 1250,
      missPct: 25,
      points: 75,
    });
    assert.equal(state.score, 75);
    assert.equal(state.revealed, true);
    assert.equal(state.history.length, 1);
  });
});

test("Chargemaster revealAnswer reveals once, then advances rounds", async () => {
  await withChargemasterPage(async (page) => {
    const snapshots = await page.evaluate(() => {
      window.__cartridgeChargemaster.setState({
        deck: [
          {
            hospital: "Mercy South",
            city: "St. Louis, MO",
            procedure: "CT head without contrast",
            clue: "Suburban nonprofit campus.",
            price: 800,
          },
          {
            hospital: "Bayfront General",
            city: "Tampa, FL",
            procedure: "CT head without contrast",
            clue: "Waterfront emergency department.",
            price: 1200,
          },
        ],
        round: 0,
        history: [],
        score: 0,
        revealed: false,
      });

      window.__cartridgeChargemaster.revealAnswer();
      const revealed = window.__cartridgeChargemaster.getState();
      window.__cartridgeChargemaster.revealAnswer();
      const advanced = window.__cartridgeChargemaster.getState();
      return { revealed, advanced };
    });

    assert.equal(snapshots.revealed.revealed, true);
    assert.equal(snapshots.revealed.round, 0);
    assert.deepEqual(snapshots.revealed.history, [
      {
        answer: 800,
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

test("Chargemaster renders final result card and posts message", async () => {
  await withChargemasterPage(async (page) => {
    const messages = [];
    await page.exposeFunction("captureResult", (message) => {
      messages.push(message);
    });

    await page.evaluate(() => {
      window.parent.postMessage = (message) => window.captureResult(message);
      window.__cartridgeChargemaster.setState({
        history: [
          { missPct: 20, points: 80 },
          { missPct: 40, points: 60 },
          { missPct: 10, points: 90 },
          { missPct: 30, points: 70 },
          { missPct: 50, points: 50 },
        ],
        score: 350,
      });
      window.__cartridgeChargemaster.finishGame("Chargemaster complete");
    });

    await page.locator("#result:not([hidden])").waitFor();

    const expected = "Chargemaster score 350 | avg miss 30% | rounds 5";
    const resultText = await page.locator("#resultText").textContent();
    const fallbackValue = await page.locator("#copyFallback").inputValue();
    const cardText = await page.locator(".result-card").textContent();

    assert.equal(resultText, expected);
    assert.equal(fallbackValue, expected);
    assert.match(cardText, /Chargemaster complete/);
    assert.deepEqual(messages, [{ type: "cartridge-result", text: expected }]);
  });
});
