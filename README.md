# Shopify MCP Extension

A Chrome extension that connects to any Shopify store's MCP (Model Context Protocol) server. It opens as a side panel in your browser and lets you search products, view detailed product info, manage your cart, look up store policies, and inspect every MCP call — all without leaving the page you're on.

## What the Extension Does

The extension is an MCP client that lets you experiment with any Shopify store's MCP server directly from the browser. Navigate to a Shopify site, open the side panel, and start exploring.

- **Connect and discover** — Automatically detects the store's MCP server, shows connection status, and lists every available tool. Click any tool to view its description, parameter names, types, and which are required
- **Call tools with a UI** — Provides built-in interfaces for common MCP tools like search, product details, cart management, and policy lookup so you can interact with the server without writing code
- **Cart sync** — Keeps the extension and the browser's native store cart in sync in both directions, so tool calls against the cart reflect on the actual storefront
- **Debug MCP calls** — A dedicated debug tab logs every request and response with timestamps, durations, and collapsible JSON trees so you can inspect the full payloads without browser dev tools

## Shopify MCP Tools

The extension uses the MCP protocol to discover available tools, their descriptions, and parameter schemas directly from the server. Whatever the server exposes is displayed in the UI — the extension is not hardcoded to a specific set of tools. The current known tools include:

- **search_shop_catalog** — Search products by keyword, with filters
- **get_product_details** — Full product info including description, images, variants, and availability
- **update_cart** / **get_cart** — Create and manage shopping carts via the Storefront API
- **search_shop_policies_and_faqs** — Query store policies, shipping info, and FAQs

## Installation

### Option 1: Download a release

1. Download the latest `.zip` from the [Releases](https://github.com/cannuk/shopify-mcp-extension/releases) page
2. Unzip it to a folder on your computer

### Option 2: Build from source

1. Make sure you have [Node.js](https://nodejs.org/) (v18 or newer) installed
2. Download this repository (click the green **Code** button above, then **Download ZIP**) and unzip it, or clone it with git
3. Open a terminal in the project folder and run:
   ```
   npm install
   npm run build
   ```
4. The built extension will be in the `.output/chrome-mv3/` folder

### Load into Chrome

1. Open Chrome and go to `chrome://extensions`
2. Turn on **Developer mode** using the toggle in the top-right corner
3. Click **Load unpacked**
4. Select the extension folder (the unzipped release, or `.output/chrome-mv3/` if you built from source)
5. You should see **Shopify MCP Extension** appear in your extensions list

### Using the Extension

1. Go to any Shopify-powered store (e.g. [allbirds.com](https://www.allbirds.com))
2. Click the **Shopify MCP Extension** icon in the Chrome toolbar
3. A side panel will open showing the connection status and available tools
4. Start searching, browsing, and adding to your cart
5. Switch to the **Debug** tab at any time to inspect MCP calls

## Requirements

- Google Chrome (desktop)
- The Shopify store must have an MCP server enabled at `/api/mcp`

## For Developers

<details>
<summary>Development setup and architecture</summary>

### Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server with hot reload |
| `npm run build` | Production build |
| `npm run zip` | Build and package as `.zip` for distribution |
| `npm run test` | Run unit tests |
| `npm run test:watch` | Run tests in watch mode |

When using `npm run dev`, the extension reloads automatically on code changes. You may need to close and reopen the side panel to see UI updates.

### Architecture

The extension is built with [WXT](https://wxt.dev/) (a framework for building browser extensions) and TypeScript. It has these main pieces:

- **Background script** — Listens for the extension icon click and opens the side panel
- **Side panel UI** — Two-tab interface (Main and Debug) with search, cart, policy, and logging features
- **MCP client** (`lib/mcp-client.ts`) — Handles communication with the store's MCP server using JSON-RPC, with automatic logging of all calls
- **MCP log** (`lib/mcp-log.ts`) — Event-based log store that captures every request/response for the debug tab
- **JSON tree** (`lib/json-tree.ts`) — Zero-dependency collapsible JSON viewer built on native `<details>/<summary>` elements, with automatic detection and parsing of double-encoded JSON strings

### MCP Tools

The extension discovers tools dynamically from the store's MCP server. Common tools include:

| Tool | Purpose |
|------|---------|
| `search_shop_catalog` | Search products with filters |
| `get_product_details` | Full product info (description, variants, images) |
| `update_cart` | Add/remove/update cart items |
| `get_cart` | Retrieve current cart state |
| `search_shop_policies_and_faqs` | Query store policies |

### Cart Sync

Cart synchronization works by reading the browser's `cart` cookie to identify the active Shopify cart. The extension uses this token to operate on the same cart via the MCP server. After any cart change, the cookie is updated and the store's page is signaled to refresh its cart UI. When the MCP creates a new cart (e.g. adding items before the store has a cart), the new cart token is written back to the cookie so the browser picks it up.

### Testing

Tests use [Vitest](https://vitest.dev/) with the WXT Vitest plugin. DOM-dependent tests (like the JSON tree renderer) use `happy-dom`. Run with `npm test`.

</details>
