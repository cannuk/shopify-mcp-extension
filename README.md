# Shopify MCP Extension

A Chrome extension that adds an AI-powered shopping assistant to any Shopify store. It opens as a side panel in your browser and lets you search products, view details, manage your cart, and look up store policies — all without leaving the page you're on.

## What It Does

When you visit a Shopify store and open the extension, it connects to the store's MCP (Model Context Protocol) server and gives you a panel with these features:

**Search products** — Find items across the store's catalog. Results show product images, names, prices, and categories.

**View product details** — Expand any search result to see the full description, all available sizes and options, an image gallery, pricing, stock availability, and a direct link to the product page.

**Manage your cart** — Add items from search results, adjust quantities, remove items, and check out. Everything happens in the side panel so you don't lose your place on the site.

**Cart stays in sync** — The extension shares the same cart as the store website. Add something in the side panel and it shows up on the site. Add something on the site and it shows up in the side panel after a page refresh.

**Look up store policies** — Search shipping, returns, FAQs, and other store policies without hunting through footer links.

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
3. A side panel will open showing the connection status and available features
4. Start searching, browsing, and adding to your cart

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

When using `npm run dev`, the extension reloads automatically on code changes. You may need to close and reopen the side panel to see UI updates.

### Architecture

The extension is built with [WXT](https://wxt.dev/) (a framework for building browser extensions) and TypeScript. It has three main pieces:

- **Background script** — Listens for the extension icon click and opens the side panel
- **Side panel UI** — The search, cart, and policy interface that users interact with
- **MCP client** — Handles communication with the store's MCP server using JSON-RPC

### MCP Tools Used

The extension calls these tools on the store's MCP server:

| Tool | Purpose |
|------|---------|
| `search_shop_catalog` | Search products |
| `get_product_details` | Full product info |
| `update_cart` | Add/remove/update cart items |
| `get_cart` | Retrieve current cart |
| `search_shop_policies_and_faqs` | Query store policies |

### Cart Sync

Cart synchronization works by reading the browser's `cart` cookie to identify the active Shopify cart. The extension uses this token to operate on the same cart via the MCP server. After any cart change, the cookie is updated and the store's page is signaled to refresh its cart UI.

</details>
