import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { chromium } from "playwright";

const root = path.resolve(import.meta.dirname, "..");

async function with2048Page(callback) {
  const payload = await readFile(path.join(root, "cartridges/2048.html"), "utf8");
  const browser = await chromium.launch();
  const page = await browser.newPage();

  try {
    await page.setContent(payload, { waitUntil: "domcontentloaded" });
    return await callback(page);
  } finally {
    await browser.close();
  }
}

const terminalBoard = [
  [2, 2, 8, 4],
  [16, 32, 64, 128],
  [256, 512, 1024, 2],
  [4, 8, 16, 32],
];

test("2048 merges each tile once per move and scores the merged values", async () => {
  await with2048Page(async (page) => {
    const apiType = await page.evaluate(
      () => typeof window.__cartridge2048?.moveBoard,
    );

    assert.equal(apiType, "function");

    const result = await page.evaluate(() =>
      window.__cartridge2048.moveBoard(
        [
          [2, 2, 4, 4],
          [2, 0, 2, 2],
          [4, 4, 4, 0],
          [0, 0, 0, 0],
        ],
        "left",
      ),
    );

    assert.deepEqual(result, {
      board: [
        [4, 8, 0, 0],
        [4, 2, 0, 0],
        [8, 4, 0, 0],
        [0, 0, 0, 0],
      ],
      changed: true,
      gained: 24,
    });
  });
});

test("2048 renders and posts a compact copyable result card", async () => {
  await with2048Page(async (page) => {
    const message = await page.evaluate(
      () =>
        new Promise((resolve) => {
          window.addEventListener("message", (event) => resolve(event.data), {
            once: true,
          });
          window.__cartridge2048.setState({
            board: [
              [2, 4, 8, 16],
              [32, 64, 128, 256],
              [512, 1024, 2048, 0],
              [0, 0, 0, 0],
            ],
            score: 4096,
            moves: 48,
          });
          window.__cartridge2048.finishGame("Final score");
        }),
    );

    const expected = "2048 score 4096 | best tile 2048 | moves 48";
    const cardText = await page.locator(".result-card").textContent();
    const fallbackValue = await page.locator("#copyFallback").inputValue();

    assert.deepEqual(message, {
      type: "cartridge-result",
      text: expected,
    });
    assert.match(cardText, /Final score/);
    assert.match(cardText, /2048 score 4096 \| best tile 2048 \| moves 48/);
    assert.equal(fallbackValue, expected);
  });
});

test("2048 renders keyboard moves and emits a compact result card at game over", async () => {
  await with2048Page(async (page) => {
    const messages = [];
    await page.exposeFunction("captureResult", (message) => {
      messages.push(message);
    });
    await page.evaluate(() => {
      window.parent.postMessage = (message) => window.captureResult(message);
      Math.random = () => 0;
    });
    await page.evaluate((board) => {
      window.__cartridge2048.setState({ board, score: 100 });
    }, terminalBoard);

    await page.keyboard.press("ArrowLeft");

    await assertTileTexts(page, [
      "4", "8", "4", "2",
      "16", "32", "64", "128",
      "256", "512", "1024", "2",
      "4", "8", "16", "32",
    ]);
    await page.locator("#result:not([hidden])").waitFor();

    const resultText = await page.locator("#resultText").textContent();
    assert.equal(resultText, "2048 score 104 | best tile 1024 | moves 1");
    assert.deepEqual(messages, [
      {
        type: "cartridge-result",
        text: "2048 score 104 | best tile 1024 | moves 1",
      },
    ]);
  });
});

async function assertTileTexts(page, expected) {
  const actual = await page.locator(".cell").evaluateAll((cells) =>
    cells.map((cell) => cell.textContent || ""),
  );

  assert.deepEqual(actual, expected);
}
