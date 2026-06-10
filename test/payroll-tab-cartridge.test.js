import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { chromium } from "playwright";

const root = path.resolve(import.meta.dirname, "..");
const cartridgePath = path.join(root, "cartridges/payroll_tab.html");

async function withPayrollTabPage(callback) {
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

test("Payroll Tab payload is self-contained without remote URLs", async () => {
  const payload = await readFile(cartridgePath, "utf8");

  assert.doesNotMatch(payload, /https?:\/\//i);
});

test("Payroll Tab scores numeric guesses by percent miss", async () => {
  await withPayrollTabPage(async (page) => {
    const state = await page.evaluate(() => {
      window.__cartridgePayrollTab.setState({
        deck: [
          {
            title: "Senior Tunnel Signal Maintainer",
            department: "Transit Operations",
            clues: "Overtime eligible, night-shift heavy",
            pay: 100000,
          },
          {
            title: "School Food Service Manager",
            department: "Education",
            clues: "Ten-month calendar plus summer prep",
            pay: 50000,
          },
        ],
        roundIndex: 0,
        score: 0,
        guesses: [],
        revealed: false,
        finished: false,
      });
      window.__cartridgePayrollTab.submitGuess(80000);
      window.__cartridgePayrollTab.nextRound();
      window.__cartridgePayrollTab.submitGuess(65000);
      return window.__cartridgePayrollTab.getState();
    });

    assert.equal(state.score, 150);
    assert.deepEqual(
      state.guesses.map((guess) => ({
        guess: guess.guess,
        answer: guess.answer,
        missPercent: guess.missPercent,
        points: guess.points,
      })),
      [
        { guess: 80000, answer: 100000, missPercent: 20, points: 80 },
        { guess: 65000, answer: 50000, missPercent: 30, points: 70 },
      ],
    );
  });
});

test("Payroll Tab reveals answers and advances rounds", async () => {
  await withPayrollTabPage(async (page) => {
    const states = await page.evaluate(() => {
      window.__cartridgePayrollTab.setState({
        deck: [
          {
            title: "First Title",
            department: "First Department",
            clues: "First clue",
            pay: 111111,
          },
          {
            title: "Second Title",
            department: "Second Department",
            clues: "Second clue",
            pay: 222222,
          },
        ],
        roundIndex: 0,
        score: 0,
        guesses: [],
        revealed: false,
        finished: false,
      });
      window.__cartridgePayrollTab.revealAnswer();
      const revealed = window.__cartridgePayrollTab.getState();
      window.__cartridgePayrollTab.nextRound();
      const advanced = window.__cartridgePayrollTab.getState();
      return { revealed, advanced };
    });

    assert.equal(states.revealed.revealed, true);
    assert.equal(states.revealed.current.pay, 111111);
    assert.deepEqual(states.revealed.guesses, [
      {
        guess: null,
        answer: 111111,
        missPercent: 100,
        points: 0,
        revealed: true,
      },
    ]);
    assert.equal(states.advanced.roundIndex, 1);
    assert.equal(states.advanced.revealed, false);
    assert.equal(states.advanced.current.pay, 222222);
    assert.equal(states.advanced.guesses.length, 1);
  });
});

test("Payroll Tab renders final result card and posts message", async () => {
  await withPayrollTabPage(async (page) => {
    const messages = [];
    await page.exposeFunction("captureResult", (message) => {
      messages.push(message);
    });

    await page.evaluate(() => {
      window.parent.postMessage = (message) => window.captureResult(message);
      window.__cartridgePayrollTab.setState({
        deck: [
          {
            title: "First Title",
            department: "First Department",
            clues: "First clue",
            pay: 100000,
          },
          {
            title: "Second Title",
            department: "Second Department",
            clues: "Second clue",
            pay: 50000,
          },
        ],
        roundIndex: 1,
        score: 150,
        guesses: [
          { guess: 80000, answer: 100000, missPercent: 20, points: 80 },
          { guess: 65000, answer: 50000, missPercent: 30, points: 70 },
        ],
        revealed: true,
        finished: false,
      });
      window.__cartridgePayrollTab.finishGame("Final payroll");
    });

    await page.locator("#result:not([hidden])").waitFor();

    const expected = "Payroll Tab score 150 | avg miss 25% | rounds 2";
    const resultText = await page.locator("#resultText").textContent();
    const fallbackValue = await page.locator("#copyFallback").inputValue();
    const cardText = await page.locator(".result-card").textContent();

    assert.equal(resultText, expected);
    assert.equal(fallbackValue, expected);
    assert.match(cardText, /Final payroll/);
    assert.deepEqual(messages, [
      {
        type: "cartridge-result",
        text: expected,
      },
    ]);
  });
});
