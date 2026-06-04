import { beforeEach, describe, expect, it, vi } from "vitest";
import { createLinkProvider } from "./index";
import { postMessage } from "../shared/vscode-api";

vi.mock("../shared/vscode-api", () => ({
  postMessage: vi.fn(),
}));

type ProvidedLink = {
  readonly decorations?: { underline: boolean; pointerCursor: boolean };
  readonly activate: (...args: unknown[]) => void;
};

const provideLinksForLine = (lineText: string) =>
  new Promise<ReadonlyArray<ProvidedLink> | undefined>((resolve) => {
    const getLine = vi.fn(() => ({
      translateToString: () => lineText,
    }));
    const terminal = {
      buffer: {
        active: {
          getLine,
        },
      },
    };

    createLinkProvider(terminal as never).provideLinks(1, (links) => {
      // xterm.js passes 1-based bufferLineNumber, our code converts to
      // 0-based for getLine: getLine(bufferLineNumber - 1) = getLine(0)
      expect(getLine).toHaveBeenCalledWith(0);
      resolve(links as unknown as ReadonlyArray<ProvidedLink> | undefined);
    });
  });

describe("createLinkProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("links at-prefixed opencode paths with line and column suffix", async () => {
    const links = await provideLinksForLine("open @src/providers/MessageRouter.ts:120:5 now");

    expect(links).toHaveLength(1);
    links?.[0]?.activate();

    expect(postMessage).toHaveBeenCalledWith({
      type: "openFile",
      path: "src/providers/MessageRouter.ts",
      line: 120,
      endLine: undefined,
      column: 5,
    });
  });

  it("links absolute file URLs and decodes encoded spaces", async () => {
    const links = await provideLinksForLine("see file:///workspace/My%20File.ts:12");

    expect(links).toHaveLength(1);
    links?.[0]?.activate();

    expect(postMessage).toHaveBeenCalledWith({
      type: "openFile",
      path: "/workspace/My File.ts",
      line: 12,
      endLine: undefined,
      column: undefined,
    });
  });

  it("does not link malformed paths or oversized terminal lines", async () => {
    const malformedLinks = await provideLinksForLine("see http://example.com/not-a-file.ts");
    const oversizedLinks = await provideLinksForLine("a".repeat(10001));

    expect(malformedLinks).toHaveLength(0);
    expect(oversizedLinks).toBeUndefined();
  });
});
