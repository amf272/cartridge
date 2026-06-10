import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { chromium } from "playwright";

const root = path.resolve(import.meta.dirname, "..");

async function withWhoSaidItPage(callback) {
  const payload = await readFile(
    path.join(root, "cartridges/who_said_it.html"),
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

test("Who Said It payload is self-contained without remote URLs", async () => {
  const payload = await readFile(
    path.join(root, "cartridges/who_said_it.html"),
    "utf8",
  );

  assert.doesNotMatch(payload, /https?:\/\//i);
});

test("Who Said It scores picks and advances rounds deterministically", async () => {
  await withWhoSaidItPage(async (page) => {
    const state = await page.evaluate(() => {
      window.__cartridgeWhoSaidIt.setState({
        speakers: [
          { id: "planner", name: "The Planner" },
          { id: "spark", name: "The Spark" },
          { id: "critic", name: "The Critic" },
        ],
        rounds: [
          {
            quote: "Let's pick a time before the thread turns into soup.",
            answerId: "planner",
            choices: ["planner", "spark", "critic"],
          },
          {
            quote: "Counterpoint: tiny parade hats for everyone.",
            answerId: "spark",
            choices: ["planner", "spark", "critic"],
          },
          {
            quote: "I admire the ambition, but the math is on fire.",
            answerId: "critic",
            choices: ["planner", "spark", "critic"],
          },
        ],
        currentRound: 0,
        score: 0,
        streak: 0,
        bestStreak: 0,
      });

      window.__cartridgeWhoSaidIt.pick("planner");
      window.__cartridgeWhoSaidIt.pick(0);
      window.__cartridgeWhoSaidIt.pick("critic");

      return window.__cartridgeWhoSaidIt.getState();
    });

    assert.equal(state.currentRound, 3);
    assert.equal(state.score, 2);
    assert.equal(state.streak, 1);
    assert.equal(state.bestStreak, 1);
    assert.equal(state.finished, true);

    const roundLabel = await page.locator("#roundStatus").textContent();
    assert.match(roundLabel, /Round 3 of 3/);
  });
});

test("Who Said It renders and posts a compact copyable result card", async () => {
  await withWhoSaidItPage(async (page) => {
    const messages = [];
    await page.exposeFunction("captureResult", (message) => {
      messages.push(message);
    });

    await page.evaluate(() => {
      window.parent.postMessage = (message) => window.captureResult(message);
      window.__cartridgeWhoSaidIt.setState({
        score: 4,
        streak: 3,
        bestStreak: 3,
        currentRound: 5,
        rounds: [
          { quote: "a", answerId: "one", choices: ["one"] },
          { quote: "b", answerId: "one", choices: ["one"] },
          { quote: "c", answerId: "one", choices: ["one"] },
          { quote: "d", answerId: "one", choices: ["one"] },
          { quote: "e", answerId: "one", choices: ["one"] },
        ],
      });
      window.__cartridgeWhoSaidIt.finishGame("Final read");
    });

    await page.locator("#result:not([hidden])").waitFor();

    const expected = "Who Said It score 4/5 | streak 3";
    const resultText = await page.locator("#resultText").textContent();
    const fallbackValue = await page.locator("#copyFallback").inputValue();
    const cardText = await page.locator(".result-card").textContent();

    assert.equal(resultText, expected);
    assert.equal(fallbackValue, expected);
    assert.match(cardText, /Final read/);
    assert.deepEqual(messages, [{ type: "cartridge-result", text: expected }]);
  });
});
