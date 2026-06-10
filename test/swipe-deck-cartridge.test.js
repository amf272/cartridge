import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { chromium } from "playwright";

const root = path.resolve(import.meta.dirname, "..");

async function withSwipePage(callback, options = {}) {
  let payload = await readFile(
    path.join(root, "cartridges/swipe_deck.html"),
    "utf8",
  );
  assert.doesNotMatch(payload, /https?:\/\//i);
  if (options.beforeMainScript) {
    payload = payload.replace(
      "<script>\n    const defaultDeck",
      options.beforeMainScript + "\n  <script>\n    const defaultDeck",
    );
  }

  const browser = await chromium.launch();
  const page = await browser.newPage();

  try {
    await page.setContent(payload, { waitUntil: "domcontentloaded" });
    return await callback(page);
  } finally {
    await browser.close();
  }
}

test("Swipe Decks ranks liked cards by learned tag scores", async () => {
  await withSwipePage(async (page) => {
    const state = await page.evaluate(() => {
      window.__cartridgeSwipeDeck.setState({
        deck: [
          { id: "a", name: "Museum Friday", text: "Late hours and a calm room.", tags: ["art", "quiet"] },
          { id: "b", name: "Stoop Lamp", text: "Free lamp, maybe haunted.", tags: ["finds", "weird"] },
          { id: "c", name: "Soup Counter", text: "Steam, cash, regulars.", tags: ["food", "quiet"] },
        ],
      });
      window.__cartridgeSwipeDeck.swipe(true);
      window.__cartridgeSwipeDeck.swipe(false);
      window.__cartridgeSwipeDeck.swipe(true);
      return window.__cartridgeSwipeDeck.getState();
    });

    assert.equal(state.finished, true);
    assert.equal(state.history.length, 3);
    assert.equal(state.liked.length, 2);
    assert.deepEqual(
      state.ranking.map((item) => item.name),
      ["Museum Friday", "Soup Counter"],
    );
    assert.equal(state.tagScores.quiet, 1);
    assert.equal(state.tagScores.weird, -0.35);
  });
});

test("Swipe Decks renders and posts a compact result card", async () => {
  await withSwipePage(async (page) => {
    const messages = [];
    await page.exposeFunction("captureResult", (message) => {
      messages.push(message);
    });
    await page.evaluate(() => {
      window.parent.postMessage = (message) => window.captureResult(message);
      window.__cartridgeSwipeDeck.setState({
        deck: [
          { id: "a", name: "A", text: "Alpha", tags: ["art"] },
          { id: "b", name: "B", text: "Beta", tags: ["food"] },
        ],
      });
      window.__cartridgeSwipeDeck.swipe(true);
      window.__cartridgeSwipeDeck.finishGame("Ranked picks");
    });

    const expected = "Swipe Decks liked 1 | top A | swipes 1";
    const cardText = await page.locator(".result-card").textContent();
    const fallbackValue = await page.locator("#copyFallback").inputValue();

    assert.match(cardText, /Ranked picks/);
    assert.match(cardText, /Swipe Decks liked 1 \| top A \| swipes 1/);
    assert.equal(fallbackValue, expected);
    assert.deepEqual(messages, [
      {
        type: "cartridge-result",
        text: expected,
      },
    ]);
  });
});

test("Swipe Decks disables page scroll interference on the card surface", async () => {
  await withSwipePage(async (page) => {
    const styles = await page.evaluate(() => ({
      htmlOverflow: getComputedStyle(document.documentElement).overflow,
      bodyOverflow: getComputedStyle(document.body).overflow,
      cardTouchAction: getComputedStyle(document.getElementById("card")).touchAction,
    }));

    assert.equal(styles.htmlOverflow, "hidden");
    assert.equal(styles.bodyOverflow, "hidden");
    assert.equal(styles.cardTouchAction, "none");
  });
});

test("Swipe Decks loads an embedded custom deck and swipes it", async () => {
  const embeddedDeck = [
    { id: "custom-a", name: "Rooftop Cinema", text: "Skyline, subtitles, folding chairs.", tags: ["movie", "outside"] },
    { name: "Dumpling Walk", text: "Three stops and a bench.", tags: "food" },
  ];

  await withSwipePage(
    async (page) => {
      const state = await page.evaluate(() => {
        window.__cartridgeSwipeDeck.swipe(true);
        window.__cartridgeSwipeDeck.swipe(false);
        return window.__cartridgeSwipeDeck.getState();
      });

      assert.equal(state.finished, true);
      assert.deepEqual(
        state.deck.map((item) => item.name),
        ["Rooftop Cinema", "Dumpling Walk"],
      );
      assert.deepEqual(state.history, [
        { id: "custom-a", liked: true },
        { id: "item-2", liked: false },
      ]);
      assert.deepEqual(state.deck[1].tags, ["food"]);
    },
    {
      beforeMainScript:
        "  <script>window.__cartridgeSwipeDeckItems = " +
        JSON.stringify(embeddedDeck) +
        ";</script>",
    },
  );
});

test("Swipe Decks exposes loadDeck for normalized replacement decks", async () => {
  await withSwipePage(async (page) => {
    const state = await page.evaluate(() => {
      window.__cartridgeSwipeDeck.loadDeck([
        { name: "Only Name" },
        { id: "tagged", name: "Tagged", text: "Has one tag.", tags: ["quiet"] },
      ]);
      return window.__cartridgeSwipeDeck.getState();
    });

    assert.equal(state.current, 0);
    assert.equal(state.finished, false);
    assert.deepEqual(state.deck, [
      { id: "item-1", name: "Only Name", text: "", tags: [] },
      { id: "tagged", name: "Tagged", text: "Has one tag.", tags: ["quiet"] },
    ]);
  });
});
