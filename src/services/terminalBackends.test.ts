import { describe, expect, it } from "vitest";
import { TerminalBackendRegistry } from "./terminalBackends";

describe("TerminalBackendRegistry", () => {
  it("isAvailable returns true for native only", () => {
    const registry = new TerminalBackendRegistry();

    expect(registry.isAvailable("native")).toBe(true);
  });

  it("resolveAvailable always resolves to native", () => {
    const registry = new TerminalBackendRegistry();

    expect(registry.resolveAvailable("native")).toBe("native");
  });
});
