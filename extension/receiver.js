/**
 * receiver.js — Content script injected into the React app (localhost).
 * Receives attendance data from the background service worker
 * and dispatches it as a custom DOM event for the React app to consume.
 */

console.log("[Attendance Interceptor] receiver.js loaded on:", window.location.href);

// Listen for messages from background service worker
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "ATTENDANCE_DATA_RECEIVED") {
    const { records } = message.payload;

    console.log(
      "[Attendance Interceptor] receiver.js: got",
      records.length,
      "records — dispatching to React app via CustomEvent"
    );

    // Dispatch a custom event on the window that the React app listens for
    window.dispatchEvent(
      new CustomEvent("AttendanceDataFromExtension", {
        detail: { records },
      })
    );

    sendResponse({ success: true });
    return true;
  }
});

// Also check chrome.storage.local on page load for any pending data
chrome.storage.local.get(["lastInterceptedData", "lastInterceptedAt"], (result) => {
  if (result.lastInterceptedData) {
    const interceptedAt = new Date(result.lastInterceptedAt).getTime();
    const now = Date.now();
    // Only auto-inject if data is from the last 5 minutes
    if (now - interceptedAt < 5 * 60 * 1000) {
      console.log(
        "[Attendance Interceptor] receiver.js: found recent stored data (",
        result.lastInterceptedData.length,
        "records), dispatching..."
      );
      // Small delay to let React app mount first
      setTimeout(() => {
        window.dispatchEvent(
          new CustomEvent("AttendanceDataFromExtension", {
            detail: { records: result.lastInterceptedData },
          })
        );
      }, 1000);
    }
  }
});
