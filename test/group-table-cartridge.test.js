import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { chromium } from "playwright";

const root = path.resolve(import.meta.dirname, "..");

async function withGroupTablePage(callback) {
  const payload = await readFile(
    path.join(root, "cartridges/group_table.html"),
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

test("Group Table payload is self-contained without remote URLs", async () => {
  const payload = await readFile(
    path.join(root, "cartridges/group_table.html"),
    "utf8",
  );

  assert.doesNotMatch(payload, /https?:\/\//i);
});

test("Group Table advances players and chooses the least-misery winner", async () => {
  await withGroupTablePage(async (page) => {
    const state = await page.evaluate(() => {
      window.__cartridgeGroupTable.setState({
        players: ["Ari", "Bo", "Cy"],
        options: [
          { id: "noodle", name: "Noodle Clock" },
          { id: "bistro", name: "Bright Bistro" },
          { id: "taco", name: "Taco Harbor" },
          { id: "sushi", name: "Sushi Meter" },
        ],
        currentPlayer: 0,
        ratings: {},
        vetoes: {},
      });

      window.__cartridgeGroupTable.rate("noodle", 5);
      window.__cartridgeGroupTable.rate("bistro", 10);
      window.__cartridgeGroupTable.rate("taco", 5);
      window.__cartridgeGroupTable.veto("sushi");
      window.__cartridgeGroupTable.nextPlayer();

      window.__cartridgeGroupTable.rate("noodle", 6);
      window.__cartridgeGroupTable.rate("bistro", 9);
      window.__cartridgeGroupTable.rate("taco", 5);
      window.__cartridgeGroupTable.rate("sushi", 10);
      window.__cartridgeGroupTable.nextPlayer();

      window.__cartridgeGroupTable.rate("noodle", 7);
      window.__cartridgeGroupTable.rate("bistro", 0);
      window.__cartridgeGroupTable.rate("taco", 5);
      window.__cartridgeGroupTable.rate("sushi", 10);
      window.__cartridgeGroupTable.finishGame("Table picked");

      return window.__cartridgeGroupTable.getState();
    });

    assert.equal(state.currentPlayer, 2);
    assert.equal(state.finished, true);
    assert.equal(state.winner.id, "noodle");
    assert.equal(state.winner.name, "Noodle Clock");
    assert.equal(state.winner.score, 18);
    assert.equal(state.winner.vetoes, 0);
    assert.equal(state.standings[0].id, "noodle");
    assert.equal(
      state.standings.find((option) => option.id === "sushi").vetoes,
      1,
    );

    const playerLabel = await page.locator("#playerStatus").textContent();
    assert.match(playerLabel, /Cy/);
  });
});

test("Group Table renders and posts a compact copyable result card", async () => {
  await withGroupTablePage(async (page) => {
    const messages = [];
    await page.exposeFunction("captureResult", (message) => {
      messages.push(message);
    });

    await page.evaluate(() => {
      window.parent.postMessage = (message) => window.captureResult(message);
      window.__cartridgeGroupTable.setState({
        players: ["Ari", "Bo", "Cy"],
        options: [
          { id: "noodle", name: "Noodle Clock" },
          { id: "bistro", name: "Bright Bistro" },
        ],
        ratings: {
          noodle: { 0: 5, 1: 6, 2: 7 },
          bistro: { 0: 10, 1: 9, 2: 0 },
        },
        vetoes: {},
        currentPlayer: 2,
      });
      window.__cartridgeGroupTable.finishGame("Table picked");
    });

    await page.locator("#result:not([hidden])").waitFor();

    const expected = "Group Table winner Noodle Clock | score 18 | vetoes 0";
    const resultText = await page.locator("#resultText").textContent();
    const fallbackValue = await page.locator("#copyFallback").inputValue();
    const cardText = await page.locator(".result-card").textContent();

    assert.equal(resultText, expected);
    assert.equal(fallbackValue, expected);
    assert.match(cardText, /Table picked/);
    assert.deepEqual(messages, [{ type: "cartridge-result", text: expected }]);
  });
});
