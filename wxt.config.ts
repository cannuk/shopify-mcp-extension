import { defineConfig } from "wxt";

export default defineConfig({
  manifest: {
    name: "Shopify MCP Explorer",
    description: "MCP client for Shopify storefronts",
    icons: {
      16: "icon-16.png",
      32: "icon-32.png",
      48: "icon-48.png",
      128: "icon-128.png",
    },
    action: {
      default_icon: {
        16: "icon-16.png",
        32: "icon-32.png",
        48: "icon-48.png",
        128: "icon-128.png",
      },
    },
    permissions: ["activeTab", "scripting", "sidePanel", "tabs"],
    host_permissions: ["<all_urls>"],
    side_panel: {
      default_path: "sidepanel.html",
    },
  },
});
