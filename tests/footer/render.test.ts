import assert from "node:assert/strict";
import { test } from "node:test";
import { visibleWidth } from "@earendil-works/pi-tui";
import { renderFooter } from "../../extensions/footer/render.ts";
import { plain, view } from "./render-fixtures.ts";

test("wide footer preserves identity and model, hides counts, keeps cache and existing cost format", () => {
  const lines = renderFooter(view(), 140, plain);
  assert.equal(lines.length, 2);
  assert.equal(lines[0], "~/project (main) \u2022 My session");
  assert.match(lines[1]!, /Cache 92\.0% \$0\.123  \u2588{16} /);
  assert.doesNotMatch(lines[1]!, /Context|[\[\]\u2500\u2501\u2502]/);
  assert.match(lines[1]!, /30\.0%\/200k \(auto\)/);
  assert.ok(lines[1]!.endsWith("(test-provider) test-model \u2022 high"));
  assert.doesNotMatch(lines.join("\n"), /[\u2191\u2193]|CH|R\d|W\d|~\$/);
});

test("unknown context shows ? instead of 0%, including after compaction", () => {
  const lines = renderFooter(
    view({ context: { tokens: null, percent: null, contextWindow: 200_000 } }),
    140,
    plain,
  );
  assert.match(lines.join("\n"), /\?\/200k/);
  assert.doesNotMatch(lines.join("\n"), /0\.0%\/200k/);
  const zero = renderFooter(
    view({ context: { tokens: 0, percent: 0, contextWindow: 200_000 } }),
    140,
    plain,
  );
  assert.match(zero.join("\n"), /0\.0%\/200k/);
});

test("cost suppression and subscription annotation stay unchanged", () => {
  const empty = view({ stats: { cost: 0, cacheHitRate: undefined } });
  assert.match(renderFooter(empty, 140, plain).join("\n"), /Cache \u2014/);
  assert.doesNotMatch(renderFooter(empty, 140, plain).join("\n"), /\$/);
  assert.match(
    renderFooter({ ...empty, subscription: true }, 140, plain).join("\n"),
    /\$0\.000 \(sub\)/,
  );
  assert.match(
    renderFooter(view({ subscription: true }), 140, plain).join("\n"),
    /\$0\.123 \(sub\)/,
  );
  assert.match(
    renderFooter(
      view({ stats: { cost: 0.1234, cacheHitRate: 0 } }),
      140,
      plain,
    ).join("\n"),
    /Cache 0\.0%/,
  );
});

test("auto compaction label follows the setting without changing context visuals", () => {
  assert.doesNotMatch(
    renderFooter(view({ autoCompact: false }), 140, plain).join("\n"),
    /\(auto\)/,
  );
});

test("layout boundaries shorten the bar, omit the provider, then add a model row", () => {
  // Fixed examples are independent of the production formatting and width helpers.
  const cases = [
    { width: 89, cells: 16, provider: true },
    { width: 88, cells: 8, provider: true },
    { width: 81, cells: 8, provider: true },
    { width: 80, cells: 8, provider: false },
    { width: 65, cells: 8, provider: false },
  ];
  for (const { width, cells, provider } of cases) {
    const lines = renderFooter(view(), width, plain);
    assert.equal(lines.length, 2, `width ${width}`);
    assert.equal(lines[1]!.match(/\u2588+/)?.[0].length, cells);
    const identity = `${provider ? "(test-provider) " : ""}test-model \u2022 high`;
    assert.equal(lines[1]!.slice(-identity.length), identity);
    assert.equal(lines[1]!.includes("(test-provider)"), provider);
  }
  const separate = renderFooter(view(), 64, plain);
  assert.equal(separate.length, 3);
  assert.equal(
    separate[1],
    `Cache 92.0% $0.123  ${"\u2588".repeat(16)} 30.0%/200k (auto)`,
  );
  assert.equal(separate[2], "(test-provider) test-model \u2022 high");
});

test("narrow layouts preserve numeric capacity ahead of bar and auto", () => {
  const lines = renderFooter(view(), 20, plain);
  assert.equal(lines.length, 4);
  assert.equal(lines[1], "Cache 92.0% $0.123");
  assert.equal(lines[2], "30.0%/200k");
});

test("every line fits at all widths, with ANSI, wide characters, and unknown context", () => {
  const ansi: typeof plain = { fg: (_color, text) => `\x1b[32m${text}\x1b[0m` };
  for (const context of [
    view().context,
    { tokens: null, percent: null, contextWindow: 1_000_000 },
  ]) {
    const state = view({
      cwd: "/tmp/\u9879\u76ee",
      sessionName: "\u5de5\u4f5c",
      context,
      model: {
        id: "\u6a21\u578b",
        thinkingLevel: "high",
        provider: undefined,
        route: undefined,
      },
    });
    for (let width = 1; width <= 180; width++) {
      const lines = renderFooter(state, width, ansi);
      for (const line of lines) {
        assert.ok(
          visibleWidth(line) <= width,
          `Overflow at width ${width}: ${line}`,
        );
        assert.doesNotMatch(line, /[\r\n\t]/);
      }
      if (width >= 16) assert.match(lines.join("\n"), /\/200k|\/1\.0M/);
    }
  }
  assert.deepEqual(renderFooter(view(), 0, plain), []);
});
