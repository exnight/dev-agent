import assert from "node:assert/strict";
import { test } from "node:test";
import type { ExtensionAPI, SessionEntry } from "@earendil-works/pi-coding-agent";
import usageExtension, { runUsage, type UsageContext } from "../../extensions/usage/index.ts";
import { assistant, usage } from "./fixtures.ts";

type Command = Parameters<ExtensionAPI["registerCommand"]>[1];
type Notification = { message: string; level: string | undefined };

function register(): Command {
  let command: Command | undefined;
  usageExtension({
    registerCommand(name, definition) {
      assert.equal(name, "usage");
      command = definition;
    },
  });
  assert.ok(command);
  return command;
}

function context(entries: SessionEntry[], hasUI = true) {
  const notifications: Notification[] = [];
  const ctx: UsageContext = {
    hasUI,
    sessionManager: { getEntries: () => entries },
    ui: { notify: (message, level) => { notifications.push({ message, level }); } },
  };
  return { ctx, notifications };
}

function notificationAt(notifications: Notification[], index: number): Notification {
  const notification = notifications[index];
  assert.ok(notification, `Expected notification ${index}`);
  return notification;
}

test("registers only a command, with details and rates completions", () => {
  const command = register();
  assert.deepEqual(command.getArgumentCompletions?.("d"), [{ value: "details", label: "details" }]);
  assert.deepEqual(command.getArgumentCompletions?.("r"), [{ value: "rates", label: "rates" }]);
  assert.deepEqual(command.getArgumentCompletions?.(""), [
    { value: "details", label: "details" },
    { value: "rates", label: "rates" },
  ]);
  assert.equal(command.getArgumentCompletions?.("unknown"), null);
});

test("each argument sends one notification from the raw session entries", () => {
  const { ctx, notifications } = context([assistant(usage({ input: 1 }))]);
  runUsage("", ctx);
  assert.equal(notifications.length, 1);
  assert.equal(notificationAt(notifications, 0).level, "info");
  assert.match(notificationAt(notifications, 0).message, /Total: \$1\.00/);
  runUsage(" details ", ctx);
  assert.match(notificationAt(notifications, 1).message, /By source/);
  runUsage(" RATES ", ctx);
  assert.match(notificationAt(notifications, 2).message, /^Rates \(USD per million tokens/);
});

test("unknown arguments warn without reading session history", () => {
  const { ctx, notifications } = context([]);
  ctx.sessionManager.getEntries = () => { throw new Error("Should not read entries"); };
  for (const args of ["help", "specs", "--help", "unexpected", "constructor"]) runUsage(args, ctx);
  assert.equal(notifications.length, 5);
  for (const notification of notifications) {
    assert.equal(notification.level, "warning");
    assert.match(notification.message, /Unknown \/usage argument/);
    assert.match(notification.message, /Usage: \/usage \[details\|rates\]/);
  }
});

test("reports unverified pricing as a warning", () => {
  const { ctx, notifications } = context([assistant(usage({}, { input: 100 }))]);
  runUsage("", ctx);
  assert.equal(notificationAt(notifications, 0).level, "warning");
});

test("incomplete component costs warn without relabeling the recorded total", () => {
  const { ctx, notifications } = context([assistant(usage({ input: 1, output: 2, total: 10 }))]);
  runUsage("", ctx);
  const notification = notificationAt(notifications, 0);
  assert.equal(notification.level, "warning");
  assert.match(notification.message, /^Total: \$10\.00$/m);
  assert.match(notification.message, /Warning: some cost components/);
  assert.doesNotMatch(notification.message, /Recorded subtotal:/);
});

test("headless output goes to stderr, never stdout or unavailable UI", (t) => {
  const { ctx, notifications } = context([], false);
  let output = "";
  t.mock.method(process.stderr, "write", (chunk: string | Uint8Array) => {
    output += chunk.toString();
    return true;
  });
  t.mock.method(process.stdout, "write", () => { throw new Error("Must preserve protocol stdout"); });
  runUsage("", ctx);
  assert.match(output, /Session usage \(estimated USD\)/);
  output = "";
  runUsage("bogus", ctx);
  assert.match(output, /^Unknown \/usage argument: bogus\n/);
  assert.equal(notifications.length, 0);
});

test("unknown argument echo has control characters removed", () => {
  const { ctx, notifications } = context([]);
  runUsage("bad\x1b[2J\nargument", ctx);
  const { message } = notificationAt(notifications, 0);
  assert.doesNotMatch(message.split("\n")[0] ?? "", /[\x00-\x1f\x7f-\x9f]/);
  assert.match(message, /^Unknown \/usage argument: bad\[2Jargument\nUsage:/);
});
