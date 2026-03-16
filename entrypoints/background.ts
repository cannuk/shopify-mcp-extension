export default defineBackground(() => {
  // Open side panel when the extension icon is clicked
  chrome.action.onClicked.addListener((tab) => {
    if (tab.id) {
      chrome.sidePanel.open({ tabId: tab.id });
    }
  });

  console.log("Shopify MCP Explorer loaded.");
});
