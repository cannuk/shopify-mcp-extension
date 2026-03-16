import {
  type McpState,
  type McpProduct,
  type CartData,
  createMcpState,
  mcpInitialize,
  mcpListTools,
  mcpToolCall,
  fetchBrowserCartToken,
  syncCartCookie,
  refreshBrowserCart,
  sanitize,
} from "../../lib/mcp-client";
import { mcpLog, type McpLogEntry } from "../../lib/mcp-log";
import { createJsonTree } from "../../lib/json-tree";

const mcpState: McpState = createMcpState();

// DOM helpers
function $(id: string): HTMLElement | null {
  return document.getElementById(id);
}

function showView(name: "loading" | "empty" | "mcp") {
  const views = ["view-loading", "view-empty", "view-mcp"];
  views.forEach((v) => {
    const el = $(v);
    if (el) el.classList.toggle("hidden", v !== `view-${name}`);
  });
}

async function detectShopify(tabId: number): Promise<boolean> {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => !!(window as any).Shopify,
      world: "MAIN",
    });
    return results?.[0]?.result === true;
  } catch {
    return false;
  }
}

// ─── MCP Search ───────────────────────────────────
function setupSearch() {
  const input = $("mcp-search-query") as HTMLInputElement;
  const btn = $("mcp-search-btn") as HTMLButtonElement;
  const results = $("mcp-search-results")!;

  const doSearch = async () => {
    const query = input.value.trim();
    if (!query) return;
    results.innerHTML =
      '<div class="mcp-loading"><div class="spinner"></div>Searching...</div>';
    btn.disabled = true;
    try {
      const res = await mcpToolCall(mcpState, "search_shop_catalog", {
        query,
        context: "User browsing via Shopify MCP extension",
      });
      const text = res.content?.[0]?.text;
      const data = text ? JSON.parse(text) : {};
      const products: McpProduct[] = data.products || [];
      results.replaceChildren();
      if (!products.length) {
        results.innerHTML =
          '<div class="mcp-empty">No products found. Try different keywords.</div>';
        return;
      }
      products.forEach((p) => results.appendChild(createProductCard(p)));
    } catch (e: any) {
      results.innerHTML = `<div class="mcp-empty">Error: ${sanitize(e.message)}</div>`;
    } finally {
      btn.disabled = false;
    }
  };

  btn.addEventListener("click", doSearch);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") doSearch();
  });
}

function formatProductDetails(raw: Record<string, unknown> | string): string {
  // Handle double-encoded JSON strings
  let data = raw;
  if (typeof data === "string") {
    try { data = JSON.parse(data); } catch { /* use as-is */ }
  }
  const p = ((data as Record<string, unknown>).product || data) as Record<string, unknown>;
  const parts: string[] = [];

  // Image gallery
  const images = (p.images || []) as Array<{ url: string; alt_text?: string }>;
  if (images.length) {
    const imgs = images
      .map((i) => `<img src="${sanitize(i.url)}" alt="${sanitize(i.alt_text || "")}" class="mcp-detail-img">`)
      .join("");
    parts.push(`<div class="mcp-detail-gallery">${imgs}</div>`);
  }

  // Description
  if (p.description)
    parts.push(`<div class="mcp-detail-desc">${sanitize(p.description)}</div>`);

  // Price
  const pr = p.price_range as { min?: string; max?: string; currency?: string } | undefined;
  if (pr) {
    const priceText = pr.min === pr.max ? `${pr.min} ${pr.currency || ""}` : `${pr.min} - ${pr.max} ${pr.currency || ""}`;
    parts.push(`<div class="mcp-detail-price">${sanitize(priceText)}</div>`);
  }

  // Options (e.g. Size)
  const options = (p.options || []) as Array<{ name: string; values: string[] }>;
  if (options.length) {
    const rows = options
      .map((o) => `<div><strong>${sanitize(o.name)}:</strong> ${sanitize(o.values?.join(", "))}</div>`)
      .join("");
    parts.push(`<div class="mcp-detail-options">${rows}</div>`);
  }

  // Selected variant
  const sv = p.selectedOrFirstAvailableVariant as Record<string, unknown> | undefined;
  if (sv) {
    const avail = sv.available !== false ? "In stock" : "Sold out";
    parts.push(
      `<div class="mcp-detail-variant"><strong>Selected:</strong> ${sanitize(sv.title)} — ${sanitize(sv.price)} ${sanitize(sv.currency)} (${avail})</div>`
    );
  }

  // Product link
  if (p.url)
    parts.push(`<div class="mcp-detail-link"><a href="${sanitize(p.url)}" target="_blank">View on store</a></div>`);

  return parts.length
    ? parts.join("")
    : `<pre class="mcp-detail-raw">${sanitize(JSON.stringify(data, null, 2))}</pre>`;
}

function createProductCard(product: McpProduct): HTMLElement {
  const card = document.createElement("div");
  card.className = "mcp-result-card";

  const img = document.createElement("img");
  img.className = "mcp-result-img";
  img.src = product.image_url || "";

  const meta = document.createElement("div");
  meta.className = "mcp-result-meta";

  const title = document.createElement("div");
  title.className = "mcp-result-title";
  title.textContent = product.title;

  const price = document.createElement("div");
  price.className = "mcp-result-price";
  const min = product.price_range?.min;
  const max = product.price_range?.max;
  const currency = product.price_range?.currency || "USD";
  price.textContent = min === max ? `${min} ${currency}` : `${min} - ${max} ${currency}`;

  const type = document.createElement("div");
  type.className = "mcp-result-type";
  type.textContent = product.product_type || "";

  meta.append(title, price, type);

  const actions = document.createElement("div");
  actions.className = "mcp-result-actions";

  const variants = product.variants || [];
  if (variants.length) {
    const addBtn = document.createElement("button");
    addBtn.className = "mcp-btn-sm mcp-btn-primary";
    addBtn.textContent = "Add to Cart";
    addBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      addBtn.disabled = true;
      addBtn.textContent = "...";
      try {
        const variantId = variants[0].variant_id;
        const args: Record<string, unknown> = {
          add_items: [{ product_variant_id: variantId, quantity: 1 }],
        };
        if (mcpState.cartId) args.cart_id = mcpState.cartId;
        const res = await mcpToolCall(mcpState, "update_cart", args);
        const text = res.content?.[0]?.text;
        const cartData = text ? JSON.parse(text) : {};
        if (cartData.cart) {
          mcpState.cartId = cartData.cart.id;
          mcpState.cartData = cartData.cart;
          renderCart();
          if (mcpState.tabId) {
            await syncCartCookie(mcpState.tabId, cartData.cart.id);
            refreshBrowserCart(mcpState.tabId);
          }
        }
        addBtn.textContent = "Added!";
        setTimeout(() => {
          addBtn.textContent = "Add to Cart";
          addBtn.disabled = false;
        }, 1200);
      } catch {
        addBtn.textContent = "Error";
        setTimeout(() => {
          addBtn.textContent = "Add to Cart";
          addBtn.disabled = false;
        }, 1500);
      }
    });
    actions.appendChild(addBtn);
  }

  if (product.product_id) {
    const detailsBtn = document.createElement("button");
    detailsBtn.className = "mcp-btn-sm";
    detailsBtn.textContent = "Details";

    const detailsPanel = document.createElement("div");
    detailsPanel.className = "mcp-product-details hidden";

    detailsBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      if (!detailsPanel.classList.contains("hidden")) {
        detailsPanel.classList.add("hidden");
        return;
      }
      detailsBtn.disabled = true;
      detailsBtn.textContent = "...";
      try {
        const res = await mcpToolCall(mcpState, "get_product_details", {
          product_id: product.product_id,
        });
        const text = res.content?.[0]?.text;
        const data = text ? JSON.parse(text) : {};
        detailsPanel.innerHTML = formatProductDetails(data);
        detailsPanel.classList.remove("hidden");
      } catch {
        detailsPanel.innerHTML =
          '<div class="mcp-empty">Failed to load details.</div>';
        detailsPanel.classList.remove("hidden");
      } finally {
        detailsBtn.textContent = "Details";
        detailsBtn.disabled = false;
      }
    });

    actions.appendChild(detailsBtn);
    card.append(img, meta, actions, detailsPanel);
    return card;
  }

  card.append(img, meta, actions);
  return card;
}

// ─── MCP Policy ───────────────────────────────────
function setupPolicy() {
  const input = $("mcp-policy-query") as HTMLInputElement;
  const btn = $("mcp-policy-btn") as HTMLButtonElement;
  const results = $("mcp-policy-results")!;

  const doQuery = async () => {
    const query = input.value.trim();
    if (!query) return;
    results.innerHTML =
      '<div class="mcp-loading"><div class="spinner"></div>Asking...</div>';
    btn.disabled = true;
    try {
      const res = await mcpToolCall(mcpState, "search_shop_policies_and_faqs", {
        query,
      });
      const text = res.content?.[0]?.text;
      const answers = text ? JSON.parse(text) : [];
      results.replaceChildren();
      if (!answers.length) {
        results.innerHTML =
          '<div class="mcp-empty">No policy information found for this query.</div>';
        return;
      }
      answers.forEach((a: { question?: string; answer?: string }) => {
        const div = document.createElement("div");
        div.className = "mcp-policy-answer";
        div.innerHTML = `<strong>${sanitize(a.question || query)}</strong>${sanitize(a.answer || "No answer available.")}`;
        results.appendChild(div);
      });
    } catch (e: any) {
      results.innerHTML = `<div class="mcp-empty">Error: ${sanitize(e.message)}</div>`;
    } finally {
      btn.disabled = false;
    }
  };

  btn.addEventListener("click", doQuery);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") doQuery();
  });
}

// ─── Cart ─────────────────────────────────────────
async function updateCartLine(lineId: string, newQty: number) {
  const container = $("mcp-cart-content")!;
  try {
    const args: Record<string, unknown> = { cart_id: mcpState.cartId };
    if (newQty <= 0) {
      args.remove_line_ids = [lineId];
    } else {
      args.update_items = [{ id: lineId, quantity: newQty }];
    }
    const res = await mcpToolCall(mcpState, "update_cart", args);
    const text = res.content?.[0]?.text;
    const cartData = text ? JSON.parse(text) : {};
    if (cartData.cart) {
      mcpState.cartData = cartData.cart;
      if (!cartData.cart.lines?.length) {
        mcpState.cartId = null;
        mcpState.cartData = null;
      }
    }
    renderCart();
    if (mcpState.tabId) {
      if (cartData.cart) await syncCartCookie(mcpState.tabId, cartData.cart.id);
      refreshBrowserCart(mcpState.tabId);
    }
  } catch {
    renderCart();
  }
}

function disableCartControls(container: HTMLElement) {
  container.querySelectorAll("button").forEach((b) => (b.disabled = true));
  container.style.opacity = "0.6";
  container.style.pointerEvents = "none";
}

function renderCart() {
  const container = $("mcp-cart-content")!;
  const cart = mcpState.cartData;
  if (!cart || !cart.lines?.length) {
    container.innerHTML =
      '<p class="mcp-hint">Cart is empty. Add items from search results.</p>';
    return;
  }
  container.replaceChildren();

  cart.lines.forEach((line) => {
    const lineId = line.id;
    const name = line.merchandise?.product?.title || "Item";
    const variant = line.merchandise?.title || "";
    const qty = line.quantity;
    const total = line.cost?.total_amount?.amount || "0";
    const currency = line.cost?.total_amount?.currency || "USD";

    const row = document.createElement("div");
    row.className = "mcp-cart-item";

    const info = document.createElement("div");
    info.className = "mcp-cart-item-info";
    info.innerHTML = `<span class="mcp-cart-item-name">${sanitize(name)}${variant ? ' <span class="mcp-cart-item-variant">' + sanitize(variant) + "</span>" : ""}</span>`;

    const controls = document.createElement("div");
    controls.className = "mcp-cart-controls";

    const minusBtn = document.createElement("button");
    minusBtn.className = "mcp-qty-btn";
    minusBtn.textContent = "-";
    minusBtn.addEventListener("click", () => {
      disableCartControls(container);
      updateCartLine(lineId, qty - 1);
    });

    const qtySpan = document.createElement("span");
    qtySpan.className = "mcp-qty-value";
    qtySpan.textContent = String(qty);

    const plusBtn = document.createElement("button");
    plusBtn.className = "mcp-qty-btn";
    plusBtn.textContent = "+";
    plusBtn.addEventListener("click", () => {
      disableCartControls(container);
      updateCartLine(lineId, qty + 1);
    });

    const priceSpan = document.createElement("span");
    priceSpan.className = "mcp-cart-item-price";
    priceSpan.textContent = `${total} ${currency}`;

    const removeBtn = document.createElement("button");
    removeBtn.className = "mcp-cart-remove";
    removeBtn.textContent = "\u00d7";
    removeBtn.title = "Remove";
    removeBtn.addEventListener("click", () => {
      disableCartControls(container);
      updateCartLine(lineId, 0);
    });

    controls.append(minusBtn, qtySpan, plusBtn, priceSpan, removeBtn);
    row.append(info, controls);
    container.appendChild(row);
  });

  const cartTotal = cart.cost?.total_amount?.amount || "0";
  const cartCurrency = cart.cost?.total_amount?.currency || "USD";

  const totalRow = document.createElement("div");
  totalRow.className = "mcp-cart-total";
  totalRow.innerHTML = `<span>Total</span><span>${sanitize(cartTotal)} ${sanitize(cartCurrency)}</span>`;
  container.appendChild(totalRow);

  if (cart.checkout_url) {
    const checkoutBtn = document.createElement("button");
    checkoutBtn.className = "mcp-checkout-btn";
    checkoutBtn.textContent = "Checkout";
    checkoutBtn.addEventListener("click", () =>
      chrome.tabs.create({ url: cart.checkout_url! })
    );
    container.appendChild(checkoutBtn);
  }
}

// ─── Init MCP ─────────────────────────────────────
async function loadBrowserCart(tabId: number) {
  const browserCartGid = await fetchBrowserCartToken(tabId);
  console.log("[MCP] browserCartGid:", browserCartGid);
  if (browserCartGid) {
    mcpState.cartId = browserCartGid;
    try {
      const cartRes = await mcpToolCall(mcpState, "get_cart", {
        cart_id: browserCartGid,
      });
      const text = cartRes.content?.[0]?.text;
      console.log("[MCP] get_cart response:", text);
      const cartData = text ? JSON.parse(text) : {};
      if (cartData.cart) {
        mcpState.cartId = cartData.cart.id;
        mcpState.cartData = cartData.cart;
        renderCart();
      }
    } catch (err) {
      console.error("[MCP] get_cart failed:", err);
    }
  } else {
    // Page reloaded and no cart cookie — clear MCP cart state
    mcpState.cartId = null;
    mcpState.cartData = null;
    renderCart();
  }
}

async function initMcp(origin: string, tabId: number) {
  mcpState.endpoint = `${origin}/api/mcp`;
  mcpState.tabId = tabId;

  const dot = $("mcp-dot")!;
  const statusText = $("mcp-status-text")!;
  const serverInfo = $("mcp-server-info")!;
  const toolsCloud = $("mcp-tools-cloud")!;
  const toolsList = $("mcp-tools-list")!;

  try {
    const initResult = await mcpInitialize(mcpState);

    dot.className = "mcp-dot mcp-dot-ok";
    statusText.textContent = "Connected";
    mcpState.connected = true;

    const info = initResult.serverInfo || {};
    serverInfo.classList.remove("hidden");
    serverInfo.innerHTML = `<span>Server: <strong>${sanitize(info.name || "unknown")}</strong></span><span>Version: <strong>${sanitize(info.version || "-")}</strong></span><span>Protocol: <strong>${sanitize(initResult.protocolVersion || "-")}</strong></span>`;

    const toolsResult = await mcpListTools(mcpState);
    const tools = toolsResult.tools || [];
    if (tools.length) {
      toolsList.classList.remove("hidden");
      toolsCloud.replaceChildren();
      tools.forEach((t) => {
        const pill = document.createElement("span");
        pill.className = "tool-pill";
        pill.textContent = t.name;

        const detail = document.createElement("div");
        detail.className = "tool-detail hidden";

        const parts: string[] = [];
        if (t.description) {
          parts.push(`<div class="tool-detail-desc">${sanitize(t.description)}</div>`);
        }
        const props = t.inputSchema?.properties;
        if (props) {
          const required = t.inputSchema?.required || [];
          const rows = Object.entries(props)
            .map(([name, p]) => {
              const req = required.includes(name) ? " <em>(required)</em>" : "";
              const desc = p.description ? ` — ${sanitize(p.description)}` : "";
              return `<li><code>${sanitize(name)}</code> <span class="tool-param-type">${sanitize(p.type || "")}</span>${req}${desc}</li>`;
            })
            .join("");
          parts.push(`<div class="tool-detail-params"><strong>Parameters:</strong><ul>${rows}</ul></div>`);
        }
        detail.innerHTML = parts.join("") || "<div>No additional details.</div>";

        pill.addEventListener("click", () => {
          // Close other open details
          toolsCloud.querySelectorAll(".tool-detail").forEach((d) => {
            if (d !== detail) d.classList.add("hidden");
          });
          toolsCloud.querySelectorAll(".tool-pill").forEach((p) => {
            if (p !== pill) p.classList.remove("tool-pill-active");
          });
          detail.classList.toggle("hidden");
          pill.classList.toggle("tool-pill-active");
        });

        const wrapper = document.createElement("div");
        wrapper.className = "tool-pill-wrapper";
        wrapper.append(pill, detail);
        toolsCloud.appendChild(wrapper);
      });
    }

    // Show interactive sections
    $("mcp-search-section")!.style.display = "";
    $("mcp-policy-section")!.style.display = "";
    $("mcp-cart-section")!.style.display = "";

    await loadBrowserCart(tabId);

    setupSearch();
    setupPolicy();

    // Reload cart data when the page navigates or refreshes
    chrome.tabs.onUpdated.addListener((updatedTabId, changeInfo) => {
      if (updatedTabId === tabId && changeInfo.status === "complete") {
        loadBrowserCart(tabId);
      }
    });
  } catch {
    dot.className = "mcp-dot mcp-dot-err";
    statusText.textContent = "Not available";
  }
}

// ─── Tabs ─────────────────────────────────────────
function setupTabs() {
  const tabBtns = document.querySelectorAll<HTMLButtonElement>(".tab-btn");
  const tabExtension = $("tab-extension")!;
  const tabDebug = $("tab-debug")!;

  tabBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      tabBtns.forEach((b) => b.classList.remove("tab-active"));
      btn.classList.add("tab-active");
      const tab = btn.dataset.tab;
      tabExtension.classList.toggle("hidden", tab !== "extension");
      tabDebug.classList.toggle("hidden", tab !== "debug");
    });
  });
}

// ─── Debug Log ────────────────────────────────────
function setupDebugLog() {
  const log = $("debug-log")!;
  const clearBtn = $("debug-clear-btn")!;

  clearBtn.addEventListener("click", () => {
    mcpLog.clear();
    log.innerHTML = '<p class="mcp-hint">Log cleared.</p>';
  });

  mcpLog.onEntry((entry: McpLogEntry) => {
    // Remove placeholder hint
    const hint = log.querySelector(".mcp-hint");
    if (hint) hint.remove();

    const card = document.createElement("div");
    card.className = "debug-entry";

    const ts = entry.timestamp;
    const time = `${pad(ts.getHours())}:${pad(ts.getMinutes())}:${pad(ts.getSeconds())}.${String(ts.getMilliseconds()).padStart(3, "0")}`;

    const header = document.createElement("div");
    header.className = "debug-entry-header";
    header.innerHTML = `<span class="debug-timestamp">${time}</span><span class="debug-method">${sanitize(entry.method)}</span><span class="debug-duration">${entry.durationMs}ms</span>`;
    if (entry.error) {
      header.innerHTML += `<span class="debug-error-badge">error</span>`;
    }
    card.appendChild(header);

    // Request params
    const reqSection = document.createElement("details");
    reqSection.className = "debug-section";
    const reqSummary = document.createElement("summary");
    reqSummary.textContent = "Request";
    reqSection.appendChild(reqSummary);
    reqSection.appendChild(createJsonTree(entry.params));
    card.appendChild(reqSection);

    // Response
    const resSection = document.createElement("details");
    resSection.className = "debug-section";
    const resSummary = document.createElement("summary");
    resSummary.textContent = entry.error ? "Error" : "Response";
    resSection.appendChild(resSummary);
    if (entry.error) {
      const errEl = document.createElement("div");
      errEl.className = "debug-error-text";
      errEl.textContent = entry.error;
      resSection.appendChild(errEl);
    }
    if (entry.response != null) {
      resSection.appendChild(createJsonTree(entry.response));
    }
    card.appendChild(resSection);

    log.prepend(card);
  });
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

// ─── Main ─────────────────────────────────────────
async function main() {
  setupTabs();
  setupDebugLog();
  showView("loading");

  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (
      !tab?.url ||
      !tab.id ||
      tab.url.startsWith("chrome://") ||
      tab.url.includes("google.com/webstore")
    ) {
      showView("empty");
      return;
    }

    const isShopify = await detectShopify(tab.id);
    if (!isShopify) {
      showView("empty");
      return;
    }

    showView("mcp");
    const origin = new URL(tab.url).origin;
    await initMcp(origin, tab.id);
  } catch {
    showView("empty");
  }
}

document.addEventListener("DOMContentLoaded", main);
