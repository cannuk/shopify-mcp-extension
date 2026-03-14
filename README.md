# Shopify MCP

A Chrome extension that connects to Shopify storefronts via the Model Context Protocol (MCP). It adds a side panel for searching products, viewing product details, and managing your cart — all synced with the store's native cart.

## How It Works

The extension communicates with a Shopify store's MCP server at `{store-origin}/api/mcp` using the JSON-RPC protocol. When you visit a Shopify-powered storefront and open the side panel, it automatically detects the store and connects.

Cart synchronization works by reading the store's `cart` cookie to link the browser cart with the MCP cart. When items are modified through the extension, the cookie is updated and the browser's cart UI is refreshed.

## What It Can Do

### Search Products

Type a query in the **Search** field to find products. Results show images, titles, prices, and product types.

### Product Details

Click **Details** on any search result to expand the full product info — description, image gallery, available sizes/options, pricing, variant availability, and a link to the product page on the store.

### Cart Management

- **Add to Cart** from search results
- Adjust quantities or remove items from the cart panel
- Checkout link takes you directly to the store's checkout

### Cart Sync

The side panel cart and the browser's native store cart stay in sync:

- Items added via the extension update the browser cart automatically
- Items added on the store website sync to the extension when the page reloads

### Store Policies

Search the store's FAQs and policies (shipping, returns, etc.) from the **Policies** section.

## Loading the Extension (Unpacked)

1. Download or clone this repository
2. Install dependencies and build:

   ```bash
   npm install
   npm run build
   ```

3. Open Chrome and navigate to `chrome://extensions`
4. Enable **Developer mode** (toggle in the top-right corner)
5. Click **Load unpacked**
6. Select the `.output/chrome-mv3/` directory from this project
7. Navigate to any Shopify storefront and click the extension icon to open the side panel

## Development

### Prerequisites

- Node.js (v18+)
- npm
- Google Chrome

### Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server with hot reload |
| `npm run build` | Production build |
| `npm run zip` | Build and package as `.zip` for distribution |

When using `npm run dev`, WXT automatically reloads the extension on code changes. You may still need to close and reopen the side panel to see UI updates.

### MCP Tools

The extension uses these MCP tools provided by the store's server:

- `search_shop_catalog` — Search products
- `get_product_details` — Full product information
- `update_cart` — Add/remove/update cart items
- `get_cart` — Retrieve current cart state
- `search_shop_policies_and_faqs` — Query store policies
