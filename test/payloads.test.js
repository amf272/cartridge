import assert from "node:assert/strict";
import test from "node:test";
import { encodeCartPayload, parseCartridgeInput } from "../docs/payloads.js";

const html = "<!doctype html><title>QR Test</title><h1>Scanned cartridge</h1>";

test("parses cart v1 base64url QR payloads", () => {
  const encoded = encodeCartPayload(html);
  const result = parseCartridgeInput(encoded);

  assert.equal(encoded.startsWith("cart:v1:base64url:"), true);
  assert.equal(result.payload, html);
  assert.equal(result.source, "cart-v1");
});

test("parses cartridge links copied from the hosted player", () => {
  const link = `https://aaron-ferber.github.io/cartridge/#cart=${encodeURIComponent(html)}`;
  const result = parseCartridgeInput(link);

  assert.equal(result.payload, html);
  assert.equal(result.source, "url-hash");
});

test("parses hash-only cartridge payloads", () => {
  const result = parseCartridgeInput(`#cart=${encodeURIComponent(html)}`);

  assert.equal(result.payload, html);
  assert.equal(result.source, "url-hash");
});

test("keeps raw HTML payloads valid for paste and file import", () => {
  const result = parseCartridgeInput(html);

  assert.equal(result.payload, html);
  assert.equal(result.source, "raw-html");
});
