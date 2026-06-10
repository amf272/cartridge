import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { chromium } from "playwright";

const root = path.resolve(import.meta.dirname, "..");

async function withMenusPage(callback) {
  const payload = await readFile(
    path.join(root, "cartridges/menus_of_new_york.html"),
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

test("Menus payload is self-contained without remote URLs", async () => {
  const payload = await readFile(
    path.join(root, "cartridges/menus_of_new_york.html"),
    "utf8",
  );

  assert.doesNotMatch(payload, /https?:\/\//i);
});

test("Menus scores deterministic year guesses through the page API", async () => {
  await withMenusPage(async (page) => {
    const state = await page.evaluate(() => {
      window.__cartridgeMenus.setState({
        roundIndex: 0,
        clueCount: 1,
        guesses: [],
        score: 0,
        finished: false,
        deck: [
          {
            title: "Test supper",
            year: 1932,
            clues: ["Blue plate special", "Roast squab", "Times Square"],
          },
          {
            title: "Test oyster bar",
            year: 1890,
            clues: ["Oysters", "Clam broth", "Broadway"],
          },
        ],
      });
      window.__cartridgeMenus.submitGuess(1928);
      window.__cartridgeMenus.submitGuess(1915);
      return window.__cartridgeMenus.getState();
    });

    assert.equal(state.score, 872);
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
        { guess: 1928, actual: 1932, miss: 4, points: 980 },
        { guess: 1915, actual: 1890, miss: 25, points: 765 },
      ],
    );
  });
});

test("Menus clue reveal increments visible clue count and state", async () => {
  await withMenusPage(async (page) => {
    const state = await page.evaluate(() => {
      window.__cartridgeMenus.setState({
        roundIndex: 0,
        clueCount: 1,
        guesses: [],
        deck: [
          {
            title: "Hotel menu",
            year: 1910,
            clues: ["Terrapin stew", "Waldorf service", "Fifth Avenue"],
          },
        ],
      });
      window.__cartridgeMenus.revealClue();
      return window.__cartridgeMenus.getState();
    });

    const visibleClues = await page.locator(".clue").count();
    const clueText = await page.locator(".clues").textContent();

    assert.equal(state.clueCount, 2);
    assert.equal(visibleClues, 2);
    assert.match(clueText, /Terrapin stew/);
    assert.match(clueText, /Waldorf service/);
    assert.doesNotMatch(clueText, /Fifth Avenue/);
  });
});

test("Menus final result card is copyable and posts message", async () => {
  await withMenusPage(async (page) => {
    const messages = [];
    await page.exposeFunction("captureResult", (message) => {
      messages.push(message);
    });
    await page.evaluate(() => {
      window.parent.postMessage = (message) => window.captureResult(message);
      window.__cartridgeMenus.setState({
        roundIndex: 2,
        clueCount: 1,
        score: 872,
        finished: false,
        guesses: [
          { guess: 1928, actual: 1932, miss: 4, points: 980 },
          { guess: 1915, actual: 1890, miss: 25, points: 765 },
        ],
        deck: [
          { title: "A", year: 1932, clues: ["A"] },
          { title: "B", year: 1890, clues: ["B"] },
        ],
      });
      window.__cartridgeMenus.finishGame("Check, please");
    });

    await page.locator("#result:not([hidden])").waitFor();

    const expected = "Menus score 872 | avg miss 15y | rounds 2";
    const resultText = await page.locator("#resultText").textContent();
    const fallbackValue = await page.locator("#copyFallback").inputValue();
    const cardText = await page.locator(".result-card").textContent();

    assert.equal(resultText, expected);
    assert.equal(fallbackValue, expected);
    assert.match(cardText, /Check, please/);
    assert.deepEqual(messages, [{ type: "cartridge-result", text: expected }]);
  });
});
