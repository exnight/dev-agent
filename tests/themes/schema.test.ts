import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import type { TSchema } from "typebox";
import { Compile } from "typebox/compile";

const themeUrl = new URL(
  "../../themes/github-dark-default.json",
  import.meta.url,
);

test("theme schema reference resolves from the installed Pi dependency and validates the theme", () => {
  const theme = JSON.parse(readFileSync(themeUrl, "utf8"));
  assert.equal(
    theme.$schema,
    "../node_modules/@earendil-works/pi-coding-agent/schemas/theme.schema.json",
  );
  const schemaUrl = new URL(theme.$schema, themeUrl);
  assert.equal(schemaUrl.protocol, "file:");
  const schema = JSON.parse(readFileSync(schemaUrl, "utf8")) as TSchema;
  const validator = Compile(schema);
  assert.equal(validator.Check({ ...theme, colors: {} }), false);
  assert.equal(validator.Check({ ...theme, appearance: "invalid" }), false);
  assert.ok(
    validator.Check(theme),
    JSON.stringify([...validator.Errors(theme)]),
  );
});
