import type { FooterTheme, FooterView } from "../../extensions/footer/view.ts";

export const plain: FooterTheme = { fg: (_color, text) => text };
export const marked: FooterTheme = {
  fg: (color, text) => `<${color}>${text}</${color}>`,
};

export function view(overrides: Partial<FooterView> = {}): FooterView {
  return {
    cwd: "/home/test/project",
    home: "/home/test",
    branch: "main",
    sessionName: "My session",
    stats: { cost: 0.1234, cacheHitRate: 92 },
    subscription: false,
    context: { tokens: 60_000, contextWindow: 200_000, percent: 30 },
    contextWindow: 200_000,
    autoCompact: true,
    model: {
      id: "test-model",
      thinkingLevel: "high",
      provider: "test-provider",
      route: undefined,
    },
    statuses: new Map(),
    ...overrides,
  };
}
