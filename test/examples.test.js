import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { EXAMPLE_CARTRIDGES } from "../docs/examples.js";

const root = path.resolve(import.meta.dirname, "..");

const fileBackedExamples = [
  {
    title: "2048",
    tagline: "Swipe tiles, merge powers of two.",
    file: "2048.html",
    titlePattern: /<title>2048<\/title>/,
  },
  {
    title: "Snake",
    tagline: "Swipe to steer, eat apples, dodge yourself.",
    file: "snake.html",
    titlePattern: /<title>Snake<\/title>/,
  },
  {
    title: "One-tap Runner",
    tagline: "Tap to jump, clear obstacles, push the run.",
    file: "runner.html",
    titlePattern: /<title>One-tap Runner<\/title>/,
  },
  {
    title: "Minesweeper",
    tagline: "Tap safe cells, flag mines, clear the board.",
    file: "minesweeper.html",
    titlePattern: /<title>Minesweeper<\/title>/,
  },
  {
    title: "Tetris",
    tagline: "Drop tetrominoes, clear lines, chase the stack.",
    file: "tetris.html",
    titlePattern: /<title>Tetris<\/title>/,
  },
  {
    title: "Swipe Decks",
    tagline: "Swipe a tiny deck and get ranked picks.",
    file: "swipe_deck.html",
    titlePattern: /<title>Swipe Decks<\/title>/,
  },
  {
    title: "Rentle",
    tagline: "Guess the rent from listing clues.",
    file: "rentle.html",
    titlePattern: /<title>Rentle<\/title>/,
  },
  {
    title: "Price Is Wrong",
    tagline: "Guess the civic contract sticker shock.",
    file: "price_is_wrong.html",
    titlePattern: /<title>Price Is Wrong<\/title>/,
  },
  {
    title: "Payroll Tab",
    tagline: "Guess the public payroll total.",
    file: "payroll_tab.html",
    titlePattern: /<title>Payroll Tab<\/title>/,
  },
  {
    title: "Chargemaster Roulette",
    tagline: "Guess the hospital price spread.",
    file: "chargemaster_roulette.html",
    titlePattern: /<title>Chargemaster Roulette<\/title>/,
  },
  {
    title: "Menus of New York",
    tagline: "Guess the year from old menu clues.",
    file: "menus_of_new_york.html",
    titlePattern: /<title>Menus of New York<\/title>/,
  },
  {
    title: "Hydrant Index: Jackpot",
    tagline: "Guess the ticket haul at the curb.",
    file: "hydrant_index.html",
    titlePattern: /<title>Hydrant Index: Jackpot<\/title>/,
  },
  {
    title: "Who Said It?",
    tagline: "Match the quote to the archetype.",
    file: "who_said_it.html",
    titlePattern: /<title>Who Said It\?<\/title>/,
  },
  {
    title: "Group Table",
    tagline: "Pick the table nobody hates.",
    file: "group_table.html",
    titlePattern: /<title>Group Table<\/title>/,
  },
];

for (const item of fileBackedExamples) {
  test(`bundles ${item.title} as an offline cartridge example`, async () => {
    const cartridgePath = path.join(root, "cartridges", item.file);
    const docsCartridgePath = path.join(root, "docs/cartridges", item.file);

    assert.equal(
      existsSync(cartridgePath),
      true,
      `cartridges/${item.file} should exist`,
    );
    assert.equal(
      existsSync(docsCartridgePath),
      true,
      `docs/cartridges/${item.file} should be cached with the PWA shell`,
    );

    const payload = await readFile(cartridgePath, "utf8");
    const docsPayload = await readFile(docsCartridgePath, "utf8");
    const example = EXAMPLE_CARTRIDGES.find(
      (exampleItem) => exampleItem.title === item.title,
    );

    assert.ok(example, `${item.title} should be listed in the player examples`);
    assert.equal(example.tagline, item.tagline);
    assert.equal(example.payloadPath, `./cartridges/${item.file}`);
    assert.equal(example.payload, undefined);
    assert.equal(docsPayload, payload);
    assert.match(payload, item.titlePattern);
    assert.match(payload, /postMessage/);
    assert.match(payload, /type:\s*"cartridge-result"/);
    assert.doesNotMatch(payload, /https?:\/\//);
  });
}
