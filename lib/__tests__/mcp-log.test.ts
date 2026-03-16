import { describe, it, expect, beforeEach } from "vitest";
import { mcpLog } from "../mcp-log";

function makeEntry(overrides: Partial<Omit<Parameters<typeof mcpLog.addEntry>[0], "timestamp">> = {}) {
  return {
    timestamp: new Date(),
    endpoint: "https://example.com/api/mcp",
    method: "test/method",
    params: {},
    response: null,
    error: null,
    durationMs: 10,
    ...overrides,
  };
}

describe("mcpLog", () => {
  beforeEach(() => {
    mcpLog.clear();
  });

  it("adds entries with auto-incrementing ids", () => {
    const a = mcpLog.addEntry(makeEntry({ method: "a" }));
    const b = mcpLog.addEntry(makeEntry({ method: "b" }));
    expect(b.id).toBeGreaterThan(a.id);
    expect(mcpLog.entries).toHaveLength(2);
  });

  it("prepends newest entries first", () => {
    mcpLog.addEntry(makeEntry({ method: "first" }));
    mcpLog.addEntry(makeEntry({ method: "second" }));
    expect(mcpLog.entries[0].method).toBe("second");
    expect(mcpLog.entries[1].method).toBe("first");
  });

  it("notifies listeners on addEntry", () => {
    const received: string[] = [];
    mcpLog.onEntry((entry) => received.push(entry.method));

    mcpLog.addEntry(makeEntry({ method: "notify-test" }));
    expect(received).toEqual(["notify-test"]);
  });

  it("clears all entries", () => {
    mcpLog.addEntry(makeEntry());
    mcpLog.addEntry(makeEntry());
    mcpLog.clear();
    expect(mcpLog.entries).toHaveLength(0);
  });

  it("caps entries at 200", () => {
    for (let i = 0; i < 210; i++) {
      mcpLog.addEntry(makeEntry({ method: `m${i}` }));
    }
    expect(mcpLog.entries).toHaveLength(200);
    // newest should be first
    expect(mcpLog.entries[0].method).toBe("m209");
  });

  it("preserves entry fields", () => {
    const entry = mcpLog.addEntry(
      makeEntry({
        method: "tools/call",
        params: { name: "search" },
        response: { products: [] },
        error: null,
        durationMs: 42,
      })
    );
    expect(entry.method).toBe("tools/call");
    expect(entry.params).toEqual({ name: "search" });
    expect(entry.response).toEqual({ products: [] });
    expect(entry.durationMs).toBe(42);
    expect(entry.id).toBeGreaterThan(0);
  });

  it("preserves endpoint field", () => {
    const entry = mcpLog.addEntry(
      makeEntry({ endpoint: "https://shop.com/api/ucp/mcp" })
    );
    expect(entry.endpoint).toBe("https://shop.com/api/ucp/mcp");
  });
});
