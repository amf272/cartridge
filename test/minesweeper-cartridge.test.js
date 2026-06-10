import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { chromium } from "playwright";

const root = path.resolve(import.meta.dirname, "..");

async function withMinesweeperPage(callback) {
  const payload = await readFile(
    path.join(root, "cartridges/minesweeper.html"),
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

test("Minesweeper payload is self-contained without remote URLs", async () => {
  const payload = await readFile(
    path.join(root, "cartridges/minesweeper.html"),
    "utf8",
  );

  assert.doesNotMatch(payload, /https?:\/\//i);
});

test("Minesweeper floods empty regions and reveals numbered borders", async () => {
  await withMinesweeperPage(async (page) => {
    await page.evaluate(() => {
      window.__cartridgeMinesweeper.setState({
        mines: [
          [false, false, false, false, false, false, false, false],
          [false, false, false, false, false, false, false, false],
          [false, false, false, false, false, false, false, false],
          [false, false, false, false, false, false, false, false],
          [false, false, false, false, false, false, false, false],
          [false, false, false, false, false, false, false, false],
          [false, false, false, false, false, false, true, false],
          [false, false, false, false, false, false, false, false],
        ],
        revealed: [
          [false, false, false, false, false, false, false, false],
          [false, false, false, false, false, false, false, false],
          [false, false, false, false, false, false, false, false],
          [false, false, false, false, false, false, false, false],
          [false, false, false, false, false, false, false, false],
          [false, false, false, false, false, false, false, false],
          [false, false, false, false, false, false, false, false],
          [false, false, false, false, false, false, false, false],
        ],
        flags: [
          [false, false, false, false, false, false, false, false],
          [false, false, false, false, false, false, false, false],
          [false, false, false, false, false, false, false, false],
          [false, false, false, false, false, false, false, false],
          [false, false, false, false, false, false, false, false],
          [false, false, false, false, false, false, false, false],
          [false, false, false, false, false, false, false, false],
          [false, false, false, false, false, false, false, false],
        ],
        started: true,
        seconds: 0,
      });
      window.__cartridgeMinesweeper.reveal(0, 0);
    });

    const state = await page.evaluate(() =>
      window.__cartridgeMinesweeper.getState(),
    );
    const texts = await cellTexts(page);

    assert.equal(state.ended, false);
    assert.equal(state.revealed[0][0], true);
    assert.equal(state.revealed[5][5], true);
    assert.equal(state.revealed[5][6], true);
    assert.equal(state.revealed[6][6], false);
    assert.equal(texts[5 * 8 + 6], "1");
  });
});

test("Minesweeper toggles flags through the page API", async () => {
  await withMinesweeperPage(async (page) => {
    const state = await page.evaluate(() => {
      const blank = () =>
        Array.from({ length: 8 }, () => Array(8).fill(false));
      window.__cartridgeMinesweeper.setState({
        mines: blank(),
        revealed: blank(),
        flags: blank(),
      });
      window.__cartridgeMinesweeper.toggleFlag(2, 3);
      window.__cartridgeMinesweeper.toggleFlag(1, 1);
      window.__cartridgeMinesweeper.toggleFlag(1, 1);
      return window.__cartridgeMinesweeper.getState();
    });

    assert.equal(state.flags[2][3], true);
    assert.equal(state.flags[1][1], false);
    assert.equal(state.flagCount, 1);
    assert.equal((await cellTexts(page))[2 * 8 + 3], "F");
  });
});

test("Minesweeper mine hit shows copyable result and posts message", async () => {
  await withMinesweeperPage(async (page) => {
    const messages = [];
    await page.exposeFunction("captureResult", (message) => {
      messages.push(message);
    });
    await page.evaluate(() => {
      const blank = () =>
        Array.from({ length: 8 }, () => Array(8).fill(false));
      window.parent.postMessage = (message) => window.captureResult(message);
      window.__cartridgeMinesweeper.setState({
        mines: [
          [true, false, false, false, false, false, false, false],
          [false, false, false, false, false, false, false, false],
          [false, false, false, false, false, false, false, false],
          [false, false, false, false, false, false, false, false],
          [false, false, false, false, false, false, false, false],
          [false, false, false, false, false, false, false, false],
          [false, false, false, false, false, false, false, false],
          [false, false, false, false, false, false, false, false],
        ],
        revealed: blank(),
        flags: blank(),
        started: true,
        seconds: 9,
      });
      window.__cartridgeMinesweeper.reveal(0, 0);
    });

    await page.locator("#result:not([hidden])").waitFor();

    const resultText = await page.locator("#resultText").textContent();
    const fallbackValue = await page.locator("#copyFallback").inputValue();
    const cardText = await page.locator(".result-card").textContent();

    assert.equal(resultText, "Minesweeper bust | revealed 1 | flags 0");
    assert.equal(fallbackValue, "Minesweeper bust | revealed 1 | flags 0");
    assert.match(cardText, /Mine hit/);
    assert.deepEqual(messages, [
      {
        type: "cartridge-result",
        text: "Minesweeper bust | revealed 1 | flags 0",
      },
    ]);
  });
});

async function cellTexts(page) {
  return await page.locator(".cell").evaluateAll((cells) =>
    cells.map((cell) => cell.textContent || ""),
  );
}
