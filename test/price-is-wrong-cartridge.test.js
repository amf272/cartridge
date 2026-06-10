import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { chromium } from "playwright";

const root = path.resolve(import.meta.dirname, "..");
const cartridgePath = path.join(root, "cartridges/price_is_wrong.html");

async function withPriceIsWrongPage(callback) {
  const payload = await readFile(cartridgePath, "utf8");
  const browser = await chromium.launch();
  const page = await browser.newPage();

  try {
    await page.setContent(payload, { waitUntil: "domcontentloaded" });
    return await callback(page, payload);
  } finally {
    await browser.close();
  }
}

test("Price Is Wrong payload is self-contained without remote URLs", async () => {
  const payload = await readFile(cartridgePath, "utf8");

  assert.doesNotMatch(payload, /https?:\/\//i);
});

test("Price Is Wrong scores numeric guesses by percent miss", async () => {
  await withPriceIsWrongPage(async (page) => {
    const state = await page.evaluate(() => {
      window.__cartridgePriceWrong.setState({
        deck: [
          {
            agency: "Department of Extremely Specific Signs",
            purpose: "Replace 40 laminated queue arrows",
            amount: 1000,
          },
          {
            agency: "Bureau of Folding Chairs",
            purpose: "Emergency chair inventory refresh",
            amount: 2000,
          },
        ],
        roundIndex: 0,
        score: 0,
        guesses: [],
        revealed: false,
        finished: false,
      });
      window.__cartridgePriceWrong.submitGuess(750);
      window.__cartridgePriceWrong.nextRound();
      window.__cartridgePriceWrong.submitGuess(3000);
      return window.__cartridgePriceWrong.getState();
    });

    assert.equal(state.score, 125);
    assert.deepEqual(
      state.guesses.map((guess) => ({
        guess: guess.guess,
        answer: guess.answer,
        missPercent: guess.missPercent,
        points: guess.points,
      })),
      [
        { guess: 750, answer: 1000, missPercent: 25, points: 75 },
        { guess: 3000, answer: 2000, missPercent: 50, points: 50 },
      ],
    );
  });
});

test("Price Is Wrong reveals answers and advances rounds", async () => {
  await withPriceIsWrongPage(async (page) => {
    const states = await page.evaluate(() => {
      window.__cartridgePriceWrong.setState({
        deck: [
          { agency: "First Agency", purpose: "First clue", amount: 1111 },
          { agency: "Second Agency", purpose: "Second clue", amount: 2222 },
        ],
        roundIndex: 0,
        score: 0,
        guesses: [],
        revealed: false,
        finished: false,
      });
      window.__cartridgePriceWrong.revealAnswer();
      const revealed = window.__cartridgePriceWrong.getState();
      window.__cartridgePriceWrong.nextRound();
      const advanced = window.__cartridgePriceWrong.getState();
      return { revealed, advanced };
    });

    assert.equal(states.revealed.revealed, true);
    assert.equal(states.revealed.current.amount, 1111);
    assert.deepEqual(states.revealed.guesses, [
      {
        guess: null,
        answer: 1111,
        missPercent: 100,
        points: 0,
        revealed: true,
      },
    ]);
    assert.equal(states.advanced.roundIndex, 1);
    assert.equal(states.advanced.revealed, false);
    assert.equal(states.advanced.current.amount, 2222);
    assert.equal(states.advanced.guesses.length, 1);
  });
});

test("Price Is Wrong renders final result card and posts message", async () => {
  await withPriceIsWrongPage(async (page) => {
    const messages = [];
    await page.exposeFunction("captureResult", (message) => {
      messages.push(message);
    });

    await page.evaluate(() => {
      window.parent.postMessage = (message) => window.captureResult(message);
      window.__cartridgePriceWrong.setState({
        deck: [
          { agency: "First Agency", purpose: "First clue", amount: 1000 },
          { agency: "Second Agency", purpose: "Second clue", amount: 2000 },
        ],
        roundIndex: 1,
        score: 125,
        guesses: [
          { guess: 750, answer: 1000, missPercent: 25, points: 75 },
          { guess: 3000, answer: 2000, missPercent: 50, points: 50 },
        ],
        revealed: true,
        finished: false,
      });
      window.__cartridgePriceWrong.finishGame("Final tab");
    });

    await page.locator("#result:not([hidden])").waitFor();

    const expected = "Price Is Wrong score 125 | avg miss 38% | rounds 2";
    const resultText = await page.locator("#resultText").textContent();
    const fallbackValue = await page.locator("#copyFallback").inputValue();
    const cardText = await page.locator(".result-card").textContent();

    assert.equal(resultText, expected);
    assert.equal(fallbackValue, expected);
    assert.match(cardText, /Final tab/);
    assert.deepEqual(messages, [
      {
        type: "cartridge-result",
        text: expected,
      },
    ]);
  });
});
