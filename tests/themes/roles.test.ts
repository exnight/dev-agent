import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

interface ThemeData {
  vars: Record<string, string>;
  colors: Record<string, string>;
}
const theme: ThemeData = JSON.parse(
  readFileSync(
    new URL("../../themes/github-dark-default.json", import.meta.url),
    "utf8",
  ),
);

function color(role: string): string {
  const value = theme.colors[role];
  assert.ok(value, `Missing theme role: ${role}`);
  return theme.vars[value] ?? value;
}

function luminance(hex: string): number {
  assert.match(hex, /^#[0-9a-f]{6}$/i);
  const channel = (offset: number) => {
    const srgb = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

function contrast(foreground: string, background: string): number {
  const fg = luminance(foreground);
  const bg = luminance(background);
  return (Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05);
}

test("user prompts have a distinct blue surface with the standard body text color", () => {
  assert.equal(color("userMessageBg"), "#1c2d41");
  assert.equal(color("userMessageText"), color("text"));
  assert.notEqual(color("userMessageBg"), color("toolPendingBg"));
  assert.notEqual(color("userMessageBg"), color("customMessageBg"));
  assert.equal(color("toolPendingBg"), "#161b22");
});

test("footer text roles retain AA contrast on the documented terminal background", () => {
  const background = theme.vars.bg;
  assert.ok(background);
  for (const role of ["muted", "text"]) {
    const ratio = contrast(color(role), background);
    assert.ok(
      ratio >= 4.5,
      `${role} has insufficient footer contrast: ${ratio.toFixed(2)}`,
    );
  }
});

test("prompt body text has high contrast and links/quotes retain AA contrast on the blue panel", () => {
  const background = color("userMessageBg");
  assert.ok(contrast(color("userMessageText"), background) >= 7);
  for (const role of [
    "mdLink",
    "mdLinkUrl",
    "mdQuote",
    "mdCode",
    "mdCodeBlock",
  ]) {
    const ratio = contrast(color(role), background);
    assert.ok(
      ratio >= 4.5,
      `${role} has insufficient contrast on user messages: ${ratio.toFixed(2)}`,
    );
  }
});
