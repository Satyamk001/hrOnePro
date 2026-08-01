/**
 * background.js — Service worker that receives intercepted data from content.js
 * and forwards it to the Attendance Insights React app tab.
 *
 * The app can run at:
 * - http://localhost:* (dev or serve)
 * - http://<internal-ip>:* (deployed on network)
 *
 * We identify the app tab by checking if the page title contains "Attendance Insights"
 * or if the URL is localhost.
 */

// Configurable: add your deployed app URLs here if not localhost
const APP_URL_PATTERNS = [
  "http://localhost",
  "http://127.0.0.1",
  "http://10.10.22.12",
];

function isAppTab(tab) {
  if (!tab.url) return false;
  // Match localhost or 127.0.0.1
  if (APP_URL_PATTERNS.some((pattern) => tab.url.startsWith(pattern))) return true;
  // Match any http tab with "Attendance Insights" in title (for deployed versions)
  if (tab.url.startsWith("http://") && tab.title && tab.title.includes("Attendance Insights")) return true;
  return false;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "ATTENDANCE_DATA_INTERCEPTED") {
    const { records, sourceUrl } = message.payload;

    console.log(
      "[Attendance Interceptor] Background: received",
      records.length,
      "records from",
      sourceUrl
    );

    // Store in chrome.storage.local as backup
    chrome.storage.local.set({
      lastInterceptedData: records,
      lastInterceptedAt: new Date().toISOString(),
      lastSourceUrl: sourceUrl,
    });

    // Find the React app tab and forward data
    chrome.tabs.query({}, (allTabs) => {
      const appTabs = allTabs.filter(isAppTab);

      console.log(
        "[Attendance Interceptor] Background: found",
        appTabs.length,
        "app tab(s)"
      );

      if (appTabs.length > 0) {
        for (const tab of appTabs) {
          chrome.tabs.sendMessage(
            tab.id,
            { type: "ATTENDANCE_DATA_RECEIVED", payload: { records } },
            (response) => {
              if (chrome.runtime.lastError) {
                console.warn("[Attendance Interceptor] Background: failed to send to tab", tab.id, ":", chrome.runtime.lastError.message);
              } else {
                console.log("[Attendance Interceptor] Background: sent to tab", tab.id, response);
              }
            }
          );
        }
      } else {
        console.log("[Attendance Interceptor] Background: no app tabs found. Data saved to storage — will auto-send when app opens.");
      }
    });

    sendResponse({ success: true, recordCount: records.length });
    return true;
  }
});

// When any http tab completes loading and looks like our app, send pending data
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && isAppTab(tab)) {
    // Inject receiver.js if this isn't a localhost tab (those get it from manifest)
    if (!tab.url.startsWith("http://localhost") && !tab.url.startsWith("http://127.0.0.1")) {
      chrome.scripting.executeScript({
        target: { tabId },
        files: ["receiver.js"],
      }).catch((err) => {
        console.warn("[Attendance Interceptor] Background: could not inject receiver.js:", err.message);
      });
    }

    chrome.storage.local.get(["lastInterceptedData", "lastInterceptedAt"], (result) => {
      if (result.lastInterceptedData) {
        const interceptedAt = new Date(result.lastInterceptedAt).getTime();
        const now = Date.now();
        // Auto-send if intercepted within the last 10 minutes
        if (now - interceptedAt < 10 * 60 * 1000) {
          console.log("[Attendance Interceptor] Background: auto-sending stored data to tab", tabId);
          // Small delay to let receiver.js load
          setTimeout(() => {
            chrome.tabs.sendMessage(tabId, {
              type: "ATTENDANCE_DATA_RECEIVED",
              payload: { records: result.lastInterceptedData },
            });
          }, 500);
        }
      }
    });
  }
});
