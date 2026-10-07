import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { test } from "node:test";

const root = new URL("../../extensions/", import.meta.url);

test("extension sources are ASCII only", () => {
  const files = readdirSync(root, { recursive: true, encoding: "utf8" }).filter((file) => file.endsWith(".ts"));
  assert.ok(files.length > 0, "no extension sources found");
  for (const file of files) {
    const text = readFileSync(new URL(file, root), "utf8");
    assert.match(text, /^[\x00-\x7F]*$/, `${file} contains non-ASCII characters`);
  }
});
