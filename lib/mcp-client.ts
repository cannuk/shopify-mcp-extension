export interface McpState {
  endpoint: string | null;
  connected: boolean;
  cartId: string | null;
  cartData: CartData | null;
  reqId: number;
  tabId: number | null;
}

export interface McpServerInfo {
  name?: string;
  version?: string;
}

export interface McpInitResult {
  protocolVersion?: string;
  serverInfo?: McpServerInfo;
}

export interface McpTool {
  name: string;
  description?: string;
}

export interface McpToolsResult {
  tools: McpTool[];
}

export interface McpToolCallResult {
  content?: Array<{ text?: string; type?: string }>;
}

export interface ProductVariant {
  variant_id: string;
  title?: string;
}

export interface ProductPriceRange {
  min?: string;
  max?: string;
  currency?: string;
}

export interface McpProduct {
  product_id?: string;
  title: string;
  image_url?: string;
  price_range?: ProductPriceRange;
  product_type?: string;
  variants?: ProductVariant[];
}

export interface CartLine {
  id: string;
  quantity: number;
  merchandise?: {
    product?: { title?: string };
    title?: string;
  };
  cost?: {
    total_amount?: { amount?: string; currency?: string };
  };
}

export interface CartData {
  id?: string;
  lines?: CartLine[];
  cost?: {
    total_amount?: { amount?: string; currency?: string };
  };
  checkout_url?: string;
}

export function createMcpState(): McpState {
  return {
    endpoint: null,
    connected: false,
    cartId: null,
    cartData: null,
    reqId: 0,
    tabId: null,
  };
}

export async function mcpCall(
  state: McpState,
  method: string,
  params: Record<string, unknown> = {}
): Promise<unknown> {
  if (!state.endpoint) throw new Error("MCP endpoint not set");
  state.reqId++;
  const res = await fetch(state.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: state.reqId,
      method,
      params,
    }),
  });
  const json = await res.json();
  if (json.error) throw new Error(json.error.message || "MCP error");
  return json.result;
}

export async function mcpToolCall(
  state: McpState,
  toolName: string,
  args: Record<string, unknown>
): Promise<McpToolCallResult> {
  const result = (await mcpCall(state, "tools/call", {
    name: toolName,
    arguments: args,
  })) as McpToolCallResult;
  // Unwrap double-encoded JSON text content from the server
  if (result?.content) {
    for (const item of result.content) {
      if (typeof item.text === "string") {
        try {
          const parsed = JSON.parse(item.text);
          if (typeof parsed === "string") {
            item.text = parsed;
          }
        } catch {
          // not double-encoded, leave as-is
        }
      }
    }
  }
  return result;
}

export async function mcpInitialize(
  state: McpState
): Promise<McpInitResult> {
  return mcpCall(state, "initialize", {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "shopify-mcp-extension", version: "1.0" },
  }) as Promise<McpInitResult>;
}

export async function mcpListTools(
  state: McpState
): Promise<McpToolsResult> {
  return mcpCall(state, "tools/list") as Promise<McpToolsResult>;
}

export async function fetchBrowserCartToken(
  tabId: number
): Promise<string | null> {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        const match = document.cookie
          .split("; ")
          .find((c) => c.startsWith("cart="));
        if (!match) return null;
        return decodeURIComponent(match.split("=")[1]);
      },
      world: "MAIN",
    });
    const token = results?.[0]?.result as string | null;
    if (!token) return null;
    return `gid://shopify/Cart/${token}`;
  } catch {
    return null;
  }
}

export async function syncCartCookie(
  tabId: number,
  cartGid: string
): Promise<void> {
  // Extract token from GID: "gid://shopify/Cart/TOKEN?key=KEY" -> "TOKEN?key=KEY"
  const token = cartGid.replace("gid://shopify/Cart/", "");
  if (!token) return;
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: (t: string) => {
        document.cookie = `cart=${encodeURIComponent(t)}; path=/; max-age=${60 * 60 * 24 * 14}`;
      },
      args: [token],
      world: "MAIN",
    });
  } catch {
    // silent
  }
}

export async function refreshBrowserCart(tabId: number): Promise<void> {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        fetch("/cart.js")
          .then((r) => r.json())
          .then((cart) => {
            document.dispatchEvent(
              new CustomEvent("cart:refresh", { detail: { cart } })
            );
            document.dispatchEvent(
              new CustomEvent("cart:update", { detail: { cart } })
            );
            document.dispatchEvent(
              new CustomEvent("cart:change", { detail: { cart } })
            );
            const sectionsUrl =
              window.location.origin +
              "/cart.js?sections=cart-drawer,cart-icon-bubble,cart-notification,cart-notification-button,main-cart-items,cart-live-region-text";
            fetch(sectionsUrl).catch(() => {});
          })
          .catch(() => {});
      },
      world: "MAIN",
    });
  } catch {
    // silent
  }
}

export function sanitize(str: unknown): string {
  if (!str) return "";
  const s = String(str);
  if (/^[=+\-@]/.test(s)) return "'" + s;
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
