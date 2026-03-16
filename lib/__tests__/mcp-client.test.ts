import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  createMcpState,
  mcpCall,
  mcpToolCall,
  sanitize,
  type McpState,
} from "../mcp-client";
import { mcpLog } from "../mcp-log";

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

function jsonResponse(body: unknown) {
  return Promise.resolve({
    json: () => Promise.resolve(body),
  });
}

describe("createMcpState", () => {
  it("returns a fresh state with defaults", () => {
    const state = createMcpState();
    expect(state.endpoint).toBeNull();
    expect(state.connected).toBe(false);
    expect(state.cartId).toBeNull();
    expect(state.cartData).toBeNull();
    expect(state.reqId).toBe(0);
    expect(state.tabId).toBeNull();
  });
});

describe("mcpCall", () => {
  let state: McpState;

  beforeEach(() => {
    state = createMcpState();
    state.endpoint = "https://example.com/api/mcp";
    mockFetch.mockReset();
    mcpLog.clear();
  });

  it("throws if endpoint is not set", async () => {
    state.endpoint = null;
    await expect(mcpCall(state, "test")).rejects.toThrow("MCP endpoint not set");
  });

  it("sends JSON-RPC request with correct format", async () => {
    mockFetch.mockReturnValue(jsonResponse({ result: { ok: true } }));

    await mcpCall(state, "initialize", { foo: "bar" });

    expect(mockFetch).toHaveBeenCalledWith("https://example.com/api/mcp", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: { foo: "bar" },
      }),
    });
  });

  it("returns the result from the response", async () => {
    mockFetch.mockReturnValue(jsonResponse({ result: { tools: [] } }));
    const result = await mcpCall(state, "tools/list");
    expect(result).toEqual({ tools: [] });
  });

  it("throws on JSON-RPC error response", async () => {
    mockFetch.mockReturnValue(
      jsonResponse({ error: { message: "Tool not found" } })
    );
    await expect(mcpCall(state, "tools/call", {})).rejects.toThrow(
      "Tool not found"
    );
  });

  it("increments reqId on each call", async () => {
    mockFetch.mockReturnValue(jsonResponse({ result: {} }));
    await mcpCall(state, "a");
    await mcpCall(state, "b");
    expect(state.reqId).toBe(2);
  });

  it("logs successful calls", async () => {
    mockFetch.mockReturnValue(jsonResponse({ result: { data: 1 } }));
    await mcpCall(state, "test/method", { q: "hello" });

    expect(mcpLog.entries).toHaveLength(1);
    expect(mcpLog.entries[0].method).toBe("test/method");
    expect(mcpLog.entries[0].params).toEqual({ q: "hello" });
    expect(mcpLog.entries[0].response).toEqual({ data: 1 });
    expect(mcpLog.entries[0].error).toBeNull();
    expect(mcpLog.entries[0].durationMs).toBeGreaterThanOrEqual(0);
  });

  it("logs the endpoint in each entry", async () => {
    mockFetch.mockReturnValue(jsonResponse({ result: {} }));
    await mcpCall(state, "test");

    expect(mcpLog.entries[0].endpoint).toBe("https://example.com/api/mcp");
  });

  it("logs the endpoint on error responses", async () => {
    mockFetch.mockReturnValue(
      jsonResponse({ error: { message: "fail" } })
    );
    await expect(mcpCall(state, "fail")).rejects.toThrow();

    expect(mcpLog.entries[0].endpoint).toBe("https://example.com/api/mcp");
  });

  it("logs the endpoint on network errors", async () => {
    mockFetch.mockRejectedValue(new Error("Network failure"));
    await expect(mcpCall(state, "net-fail")).rejects.toThrow();

    expect(mcpLog.entries[0].endpoint).toBe("https://example.com/api/mcp");
  });

  it("logs different endpoints for different states", async () => {
    mockFetch.mockReturnValue(jsonResponse({ result: {} }));

    await mcpCall(state, "storefront-call");

    const ucpState = createMcpState();
    ucpState.endpoint = "https://example.com/api/ucp/mcp";
    await mcpCall(ucpState, "ucp-call");

    expect(mcpLog.entries).toHaveLength(2);
    // newest first
    expect(mcpLog.entries[0].endpoint).toBe("https://example.com/api/ucp/mcp");
    expect(mcpLog.entries[0].method).toBe("ucp-call");
    expect(mcpLog.entries[1].endpoint).toBe("https://example.com/api/mcp");
    expect(mcpLog.entries[1].method).toBe("storefront-call");
  });

  it("logs error calls", async () => {
    mockFetch.mockReturnValue(
      jsonResponse({ error: { message: "bad request" } })
    );
    await expect(mcpCall(state, "fail")).rejects.toThrow();

    expect(mcpLog.entries).toHaveLength(1);
    expect(mcpLog.entries[0].error).toBe("bad request");
  });

  it("logs network errors", async () => {
    mockFetch.mockRejectedValue(new Error("Network failure"));
    await expect(mcpCall(state, "net-fail")).rejects.toThrow("Network failure");

    expect(mcpLog.entries).toHaveLength(1);
    expect(mcpLog.entries[0].error).toBe("Network failure");
    expect(mcpLog.entries[0].response).toBeNull();
  });
});

describe("mcpToolCall", () => {
  let state: McpState;

  beforeEach(() => {
    state = createMcpState();
    state.endpoint = "https://example.com/api/mcp";
    mockFetch.mockReset();
    mcpLog.clear();
  });

  it("wraps mcpCall with tools/call method", async () => {
    mockFetch.mockReturnValue(
      jsonResponse({ result: { content: [{ text: '{"ok":true}', type: "text" }] } })
    );
    const result = await mcpToolCall(state, "search", { query: "shoes" });
    expect(result.content?.[0]?.text).toBe('{"ok":true}');

    // Check it sent tools/call with name and arguments
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.method).toBe("tools/call");
    expect(body.params).toEqual({ name: "search", arguments: { query: "shoes" } });
  });

  it("unwraps double-encoded JSON strings", async () => {
    // Server returns text as a JSON string containing another JSON string
    const innerJson = '{"product":"shoes"}';
    const doubleEncoded = JSON.stringify(innerJson); // '"{\\"product\\":\\"shoes\\"}"'
    mockFetch.mockReturnValue(
      jsonResponse({ result: { content: [{ text: doubleEncoded, type: "text" }] } })
    );

    const result = await mcpToolCall(state, "get_product", { id: "1" });
    // Should unwrap one layer: text should now be the inner JSON string
    expect(result.content?.[0]?.text).toBe(innerJson);
  });

  it("leaves normal JSON text as-is", async () => {
    const normalJson = '{"product":"shoes"}';
    mockFetch.mockReturnValue(
      jsonResponse({ result: { content: [{ text: normalJson, type: "text" }] } })
    );

    const result = await mcpToolCall(state, "search", { q: "boots" });
    expect(result.content?.[0]?.text).toBe(normalJson);
  });

  it("leaves non-JSON text as-is", async () => {
    mockFetch.mockReturnValue(
      jsonResponse({ result: { content: [{ text: "plain text", type: "text" }] } })
    );

    const result = await mcpToolCall(state, "search", { q: "test" });
    expect(result.content?.[0]?.text).toBe("plain text");
  });
});

describe("sanitize", () => {
  it("returns empty string for falsy values", () => {
    expect(sanitize("")).toBe("");
    expect(sanitize(null)).toBe("");
    expect(sanitize(undefined)).toBe("");
    expect(sanitize(0)).toBe("");
  });

  it("escapes HTML special characters", () => {
    expect(sanitize("<script>alert('xss')</script>")).toBe(
      "&lt;script&gt;alert(&#039;xss&#039;)&lt;/script&gt;"
    );
  });

  it("escapes ampersands", () => {
    expect(sanitize("a & b")).toBe("a &amp; b");
  });

  it("escapes quotes", () => {
    expect(sanitize('"hello"')).toBe("&quot;hello&quot;");
  });

  it("prefixes formula injection characters with apostrophe", () => {
    expect(sanitize("=cmd")).toBe("'=cmd");
    expect(sanitize("+cmd")).toBe("'+cmd");
    expect(sanitize("-cmd")).toBe("'-cmd");
    expect(sanitize("@cmd")).toBe("'@cmd");
  });

  it("converts non-string values to string", () => {
    expect(sanitize(42)).toBe("42");
    expect(sanitize(true)).toBe("true");
  });
});
