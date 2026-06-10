import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { chromium } from "playwright";

const root = path.resolve(import.meta.dirname, "..");

async function withSnakePage(callback) {
  const payload = await readFile(path.join(root, "cartridges/snake.html"), "utf8");
  assert.doesNotMatch(payload, /https?:\/\//i);

  const browser = await chromium.launch();
  const page = await browser.newPage();

  try {
    await page.setContent(payload, { waitUntil: "domcontentloaded" });
    return await callback(page);
  } finally {
    await browser.close();
  }
}

test("snake advances, eats an apple, grows, and tracks score and moves", async () => {
  await withSnakePage(async (page) => {
    const apiType = await page.evaluate(
      () => typeof window.__cartridgeSnake?.step,
    );

    assert.equal(apiType, "function");

    await page.evaluate(() => {
      window.__cartridgeSnake.setState({
        snake: [
          { x: 3, y: 2 },
          { x: 2, y: 2 },
          { x: 1, y: 2 },
        ],
        apple: { x: 4, y: 2 },
        direction: "right",
        score: 0,
        moves: 0,
      });
      window.__cartridgeSnake.step("right");
    });

    const state = await page.evaluate(() => window.__cartridgeSnake.getState());

    assert.deepEqual(state.snake.slice(0, 4), [
      { x: 4, y: 2 },
      { x: 3, y: 2 },
      { x: 2, y: 2 },
      { x: 1, y: 2 },
    ]);
    assert.equal(state.score, 1);
    assert.equal(state.moves, 1);
    assert.equal(state.ended, false);
    assert.equal(state.snake.length, 4);
    assert.ok(!state.snake.some((part) => part.x === state.apple.x && part.y === state.apple.y));
  });
});

test("snake ends on wall and self collision through the page API", async () => {
  await withSnakePage(async (page) => {
    let state = await page.evaluate(() => {
      window.__cartridgeSnake.setState({
        snake: [
          { x: 0, y: 2 },
          { x: 1, y: 2 },
          { x: 2, y: 2 },
        ],
        apple: { x: 5, y: 5 },
        direction: "left",
      });
      window.__cartridgeSnake.step("left");
      return window.__cartridgeSnake.getState();
    });

    assert.equal(state.ended, true);
    assert.equal(state.resultTitle, "Game over");

    state = await page.evaluate(() => {
      window.__cartridgeSnake.setState({
        snake: [
          { x: 3, y: 2 },
          { x: 3, y: 3 },
          { x: 2, y: 3 },
          { x: 2, y: 2 },
        ],
        apple: { x: 5, y: 5 },
        direction: "right",
      });
      window.__cartridgeSnake.step("down");
      return window.__cartridgeSnake.getState();
    });

    assert.equal(state.ended, true);
    assert.equal(state.moves, 1);
  });
});

test("snake finish renders and posts a compact copyable result card", async () => {
  await withSnakePage(async (page) => {
    const message = await page.evaluate(
      () =>
        new Promise((resolve) => {
          window.addEventListener("message", (event) => resolve(event.data), {
            once: true,
          });
          window.__cartridgeSnake.setState({
            snake: [
              { x: 3, y: 2 },
              { x: 2, y: 2 },
              { x: 1, y: 2 },
              { x: 0, y: 2 },
            ],
            apple: { x: 5, y: 5 },
            direction: "right",
            score: 7,
            moves: 42,
          });
          window.__cartridgeSnake.finishGame("Final score");
        }),
    );

    const expected = "Snake score 7 | length 4 | moves 42";
    const cardText = await page.locator(".result-card").textContent();
    const fallbackValue = await page.locator("#copyFallback").inputValue();

    assert.deepEqual(message, {
      type: "cartridge-result",
      text: expected,
    });
    assert.match(cardText, /Final score/);
    assert.match(cardText, /Snake score 7 \| length 4 \| moves 42/);
    assert.equal(fallbackValue, expected);
  });
});

test("snake keyboard controls advance in the requested direction", async () => {
  await withSnakePage(async (page) => {
    await page.evaluate(() => {
      window.__cartridgeSnake.setState({
        snake: [
          { x: 4, y: 4 },
          { x: 4, y: 5 },
          { x: 4, y: 6 },
        ],
        apple: { x: 7, y: 7 },
        direction: "up",
        score: 0,
        moves: 0,
      });
    });

    await page.keyboard.press("ArrowRight");

    const state = await page.evaluate(() => window.__cartridgeSnake.getState());

    assert.deepEqual(state.snake[0], { x: 5, y: 4 });
    assert.equal(state.direction, "right");
    assert.equal(state.moves, 1);
  });
});
