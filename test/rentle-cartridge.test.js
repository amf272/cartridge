import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { chromium } from "playwright";

const root = path.resolve(import.meta.dirname, "..");

async function withRentlePage(callback) {
  const payload = await readFile(
    path.join(root, "cartridges/rentle.html"),
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

test("Rentle payload is self-contained without remote URLs", async () => {
  const payload = await readFile(
    path.join(root, "cartridges/rentle.html"),
    "utf8",
  );

  assert.doesNotMatch(payload, /https?:\/\//i);
});

test("Rentle scores deterministic rent guesses through the page API", async () => {
  await withRentlePage(async (page) => {
    const state = await page.evaluate(() => {
      window.__cartridgeRentle.setState({
        roundIndex: 0,
        clueCount: 1,
        guesses: [],
        score: 0,
        finished: false,
        deck: [
          {
            title: "Test studio",
            rent: 3000,
            clues: ["Studio", "Chelsea", "Dishwasher"],
          },
          {
            title: "Test two bed",
            rent: 4200,
            clues: ["Two bed", "Crown Heights", "Laundry"],
          },
        ],
      });
      window.__cartridgeRentle.submitGuess(2800);
      window.__cartridgeRentle.submitGuess(4700);
      return window.__cartridgeRentle.getState();
    });

    assert.equal(state.score, 925);
    assert.equal(state.roundIndex, 2);
    assert.equal(state.finished, true);
    assert.deepEqual(
      state.guesses.map(({ guess, actual, miss, points }) => ({
        guess,
        actual,
        miss,
        points,
      })),
      [
        { guess: 2800, actual: 3000, miss: 200, points: 960 },
        { guess: 4700, actual: 4200, miss: 500, points: 890 },
      ],
    );
  });
});

test("Rentle clue reveal increments visible clue count and state", async () => {
  await withRentlePage(async (page) => {
    const state = await page.evaluate(() => {
      window.__cartridgeRentle.setState({
        roundIndex: 0,
        clueCount: 1,
        guesses: [],
        deck: [
          {
            title: "Garden one bed",
            rent: 3300,
            clues: ["One bed", "Astoria", "Garden access"],
          },
        ],
      });
      window.__cartridgeRentle.revealClue();
      return window.__cartridgeRentle.getState();
    });

    const visibleClues = await page.locator(".clue").count();
    const clueText = await page.locator(".clues").textContent();

    assert.equal(state.clueCount, 2);
    assert.equal(visibleClues, 2);
    assert.match(clueText, /One bed/);
    assert.match(clueText, /Astoria/);
    assert.doesNotMatch(clueText, /Garden access/);
  });
});

test("Rentle final result card is copyable and posts message", async () => {
  await withRentlePage(async (page) => {
    const messages = [];
    await page.exposeFunction("captureResult", (message) => {
      messages.push(message);
    });
    await page.evaluate(() => {
      window.parent.postMessage = (message) => window.captureResult(message);
      window.__cartridgeRentle.setState({
        roundIndex: 2,
        clueCount: 1,
        score: 925,
        finished: false,
        guesses: [
          { guess: 2800, actual: 3000, miss: 200, points: 960 },
          { guess: 4700, actual: 4200, miss: 500, points: 890 },
        ],
        deck: [
          { title: "A", rent: 3000, clues: ["A"] },
          { title: "B", rent: 4200, clues: ["B"] },
        ],
      });
      window.__cartridgeRentle.finishGame("Lease signed");
    });

    await page.locator("#result:not([hidden])").waitFor();

    const expected = "Rentle score 925 | avg miss $350 | rounds 2";
    const resultText = await page.locator("#resultText").textContent();
    const fallbackValue = await page.locator("#copyFallback").inputValue();
    const cardText = await page.locator(".result-card").textContent();

    assert.equal(resultText, expected);
    assert.equal(fallbackValue, expected);
    assert.match(cardText, /Lease signed/);
    assert.deepEqual(messages, [{ type: "cartridge-result", text: expected }]);
  });
});
