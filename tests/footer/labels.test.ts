import assert from "node:assert/strict";
import { test } from "node:test";
import { renderFooter } from "../../extensions/footer/render.ts";
import { marked, plain, view } from "./render-fixtures.ts";

test("plain labels remove complete CSI and OSC sequences before flattening whitespace", () => {
  const state = view({
    cwd: "/tmp/\x1b[32mproject\x1b[0m",
    branch: "main\x1b[2J",
    sessionName: "bad\nname\x1b[2J\x07",
    model: {
      id: "\x1b]8;;https://example.com\x07model\x1b]8;;\x07\tname",
      provider: "test\x1b[2J",
      thinkingLevel: "high\nlevel",
      route: { id: "physical\x1b[31m\x1b[0m", thinkingLevel: "low\tlevel" },
    },
  });
  const lines = renderFooter(state, 140, plain);
  assert.equal(lines[0], "/tmp/project (main) \u2022 bad name");
  assert.ok(
    lines[1]!.endsWith(
      "(test) model name \u2022 high level \u2192 physical \u2022 low level",
    ),
  );
  assert.doesNotMatch(lines.join(""), /[\x00-\x1f\x7f-\x9f]/);
});

test("plain labels also remove OSC sequences terminated by ESC-backslash", () => {
  const sessionName = "\x1b]0;hidden title\x1b\\Visible";
  assert.equal(
    renderFooter(view({ sessionName }), 140, plain)[0],
    "~/project (main) \u2022 Visible",
  );
});

test("styled extension statuses keep colors, sort by key, and flatten whitespace", () => {
  const statuses = new Map([
    ["b", "second\nstatus"],
    ["a", "\x1b[32mfirst\x1b[0m\tstatus"],
  ]);
  assert.equal(
    renderFooter(view({ statuses }), 140, plain)[2],
    "\x1b[32mfirst\x1b[0m status second status",
  );
});

test("home shortening respects directory boundaries", () => {
  assert.equal(
    renderFooter(view({ cwd: "/home/test" }), 140, plain)[0],
    "~ (main) \u2022 My session",
  );
  assert.match(
    renderFooter(view({ cwd: "/home/test-other" }), 140, plain)[0]!,
    /^\/home\/test-other/,
  );
});

test("missing model and selected versus routed thinking-off labels are explicit", () => {
  assert.ok(
    renderFooter(view({ model: undefined }), 140, plain)[1]!.endsWith(
      "no-model",
    ),
  );
  const model = {
    id: "router",
    provider: "test",
    thinkingLevel: "off",
    route: { id: "physical", thinkingLevel: "off" },
  };
  const lines = renderFooter(view({ model }), 140, plain);
  assert.ok(
    lines[1]!.endsWith(
      "(test) router \u2022 thinking off \u2192 physical \u2022 off",
    ),
  );
});

test("bar styling distinguishes filled and unfilled solid cells without a warning below the threshold", () => {
  const output = renderFooter(view(), 500, marked).join("\n");
  assert.ok(
    output.includes(
      `<success>${"\u2588".repeat(5)}</success><dim>${"\u2588".repeat(11)}</dim>`,
    ),
  );
  assert.doesNotMatch(output, /<warning>|<error>/);
  const empty = view({
    context: { tokens: 0, percent: 0, contextWindow: 200_000 },
  });
  assert.ok(
    renderFooter(empty, 500, marked)
      .join("\n")
      .includes(`<dim>${"\u2588".repeat(16)}</dim>`),
  );
});

test("essential values use text or muted roles; dim is reserved for cells and clipping", () => {
  const calls: { color: string; text: string }[] = [];
  renderFooter(view(), 140, {
    fg(color, text) {
      calls.push({ color, text });
      return text;
    },
  });
  assert.ok(
    calls.some(
      ({ color, text }) => color === "text" && text === "30.0%/200k (auto)",
    ),
  );
  for (const label of [
    "Cache 92.0% $0.123",
    "~/project (main) \u2022 My session",
    "test-model \u2022 high",
  ]) {
    assert.ok(
      calls.some(({ color, text }) => color === "muted" && text === label),
      label,
    );
  }
  for (const { color, text } of calls) {
    if (color === "dim") assert.match(text, /^[\u2588\u2026]*$/);
  }
});
