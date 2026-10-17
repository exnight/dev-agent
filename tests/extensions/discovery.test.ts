import assert from "node:assert/strict";
import { cp, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { discoverAndLoadExtensions } from "@earendil-works/pi-coding-agent";

test("Pi discovers only footer and usage entry points, not their helper modules", async () => {
  const isolated = await mkdtemp(join(tmpdir(), "footer-discovery-"));
  const extensions = fileURLToPath(
    new URL("../../extensions/", import.meta.url),
  );
  try {
    const result = await discoverAndLoadExtensions(
      [extensions],
      isolated,
      isolated,
    );
    assert.deepEqual(result.errors, []);
    assert.deepEqual(
      result.extensions
        .map((extension) => relative(extensions, extension.path))
        .sort(),
      [join("footer", "index.ts"), join("usage", "index.ts")],
    );
  } finally {
    await rm(isolated, { recursive: true, force: true });
  }
});

for (const name of ["footer", "usage"]) {
  test(`${name} loads from an isolated copy without sibling extensions`, async () => {
    const isolated = await mkdtemp(join(tmpdir(), `${name}-standalone-`));
    const source = fileURLToPath(
      new URL(`../../extensions/${name}/`, import.meta.url),
    );
    const destination = join(isolated, name);
    try {
      await cp(source, destination, { recursive: true });
      const result = await discoverAndLoadExtensions(
        [destination],
        isolated,
        isolated,
      );
      assert.deepEqual(result.errors, []);
      assert.deepEqual(
        result.extensions.map((extension) => extension.path),
        [join(destination, "index.ts")],
      );
    } finally {
      await rm(isolated, { recursive: true, force: true });
    }
  });
}
