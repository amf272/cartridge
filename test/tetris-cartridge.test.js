import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { chromium } from "playwright";

const root = path.resolve(import.meta.dirname, "..");
const rows = 20;
const cols = 10;

async function withTetrisPage(callback) {
  const payload = await readFile(path.join(root, "cartridges/tetris.html"), "utf8");
  assert.doesNotMatch(payload, /https?:\/\//);

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 780 } });

  try {
    await page.setContent(payload, { waitUntil: "domcontentloaded" });
    return await callback(page);
  } finally {
    await browser.close();
  }
}

function emptyBoard() {
  return Array.from({ length: rows }, () => Array(cols).fill(null));
}

test("Tetris API moves, rotates, and hard drops a spawned piece", async () => {
  await withTetrisPage(async (page) => {
    const result = await page.evaluate((board) => {
      const required = [
        "setState",
        "getState",
        "spawn",
        "move",
        "rotate",
        "hardDrop",
        "finishGame",
      ];

      window.__cartridgeTetris.setState({
        board,
        score: 0,
        lines: 0,
        level: 1,
      });
      window.__cartridgeTetris.spawn("T");
      const before = window.__cartridgeTetris.getState();
      const moved = window.__cartridgeTetris.move("left");
      const rotated = window.__cartridgeTetris.rotate();
      const afterRotate = window.__cartridgeTetris.getState();
      const drop = window.__cartridgeTetris.hardDrop();
      const afterDrop = window.__cartridgeTetris.getState();

      return {
        apiTypes: required.map((name) => typeof window.__cartridgeTetris?.[name]),
        before,
        moved,
        rotated,
        afterRotate,
        drop,
        afterDrop,
      };
    }, emptyBoard());

    assert.deepEqual(result.apiTypes, [
      "function",
      "function",
      "function",
      "function",
      "function",
      "function",
      "function",
    ]);
    assert.equal(result.before.active.type, "T");
    assert.equal(result.moved, true);
    assert.equal(result.rotated, true);
    assert.equal(result.afterRotate.active.col, result.before.active.col - 1);
    assert.equal(
      result.afterRotate.active.rotation,
      (result.before.active.rotation + 1) % 4,
    );
    assert.ok(result.drop.distance > 0);
    assert.equal(
      result.afterDrop.board.flat().filter((cell) => cell === "T").length,
      4,
    );
  });
});

test("Tetris clears a deterministic line and scores it", async () => {
  await withTetrisPage(async (page) => {
    const board = emptyBoard();
    board[19] = Array(cols).fill("J");
    board[19][9] = null;

    const result = await page.evaluate((initialBoard) => {
      window.__cartridgeTetris.setState({
        board: initialBoard,
        active: { type: "I", row: 0, col: 9, rotation: 1 },
        score: 0,
        lines: 0,
        level: 1,
      });

      return {
        drop: window.__cartridgeTetris.hardDrop(),
        state: window.__cartridgeTetris.getState(),
      };
    }, board);

    assert.equal(result.drop.linesCleared, 1);
    assert.equal(result.state.lines, 1);
    assert.equal(result.state.score, 100);
    assert.equal(result.state.level, 1);
    assert.equal(result.state.board[19][9], "I");
    assert.equal(result.state.board[19].filter(Boolean).length, 1);
  });
});

test("Tetris finish renders a compact result card and posts it", async () => {
  await withTetrisPage(async (page) => {
    const messages = [];
    await page.exposeFunction("captureResult", (message) => {
      messages.push(message);
    });
    await page.evaluate(() => {
      window.parent.postMessage = (message) => window.captureResult(message);
    });

    await page.evaluate((board) => {
      window.__cartridgeTetris.setState({
        board,
        score: 1200,
        lines: 8,
        level: 2,
      });
      window.__cartridgeTetris.finishGame("Final score");
    }, emptyBoard());

    const expected = "Tetris score 1200 | lines 8 | level 2";
    const cardText = await page.locator(".result-card").textContent();
    const fallbackValue = await page.locator("#copyFallback").inputValue();

    assert.match(cardText, /Final score/);
    assert.match(cardText, /Tetris score 1200 \| lines 8 \| level 2/);
    assert.equal(fallbackValue, expected);
    assert.deepEqual(messages, [
      {
        type: "cartridge-result",
        text: expected,
      },
    ]);
  });
});
