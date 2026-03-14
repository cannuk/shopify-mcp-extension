import { defineConfig } from "wxt";

export default defineConfig({
  manifest: {
    name: "Shopify MCP",
    description: "MCP client for Shopify storefronts",
    action: {},
    permissions: ["activeTab", "scripting", "sidePanel", "tabs"],
    host_permissions: ["<all_urls>"],
    side_panel: {
      default_path: "sidepanel.html",
    },
  },
});
