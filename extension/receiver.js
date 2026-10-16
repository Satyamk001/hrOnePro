/**
 * receiver.js — Content script injected into the React app page.
 * Receives attendance data from the background service worker
 * and dispatches it as a custom DOM event for the React app to consume.
 *
 * This script is injected on all http/https hosts (the app may be self-hosted
 * on any LAN IP or port via `npx attendance-insights`), so it self-gates:
 * it only activates on the Attendance Insights app page and is inert elsewhere.
 */

(function () {
  // Identify the app page. The app ships a static <title>Attendance Insights</title>
  // (present before React mounts), and mounts into <div id="root">. Either
  // marker is enough; require the title to avoid false positives on unrelated
  // sites that happen to have a #root element.
  const isAppPage = document.title.includes("Attendance Insights");
  if (!isAppPage) {
    // Not our app — stay completely inert on this page.
    return;
  }

console.log("[Attendance Interceptor] receiver.js loaded on:", window.location.href);

// Listen for messages from background service worker
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "ATTENDANCE_DATA_RECEIVED") {
    const { records, profile } = message.payload;

    console.log(
      "[Attendance Interceptor] receiver.js: got",
      records.length,
      "records — dispatching to React app via CustomEvent"
    );

    // Dispatch attendance data
    window.dispatchEvent(
      new CustomEvent("AttendanceDataFromExtension", {
        detail: { records },
      })
    );

    // Dispatch profile if available
    if (profile) {
      console.log("[Attendance Interceptor] receiver.js: also dispatching profile for", profile.employeeName);
      window.dispatchEvent(
        new CustomEvent("ProfileDataFromExtension", {
          detail: { profile },
        })
      );
    }

    sendResponse({ success: true });
    return true;
  }

  if (message.type === "PROFILE_DATA_RECEIVED") {
    const { profile } = message.payload;
    console.log("[Attendance Interceptor] receiver.js: got profile for", profile.employeeName);
    window.dispatchEvent(
      new CustomEvent("ProfileDataFromExtension", {
        detail: { profile },
      })
    );
    sendResponse({ success: true });
    return true;
  }

  if (message.type === "SYNC_STATUS") {
    // Forward sync status (success/error) to the React app
    window.dispatchEvent(
      new CustomEvent("ExtensionSyncStatus", {
        detail: message.payload,
      })
    );
    sendResponse({ success: true });
    return true;
  }

  if (message.type === "TODAY_PUNCHES_RECEIVED") {
    const { punches } = message.payload;
    console.log("[Attendance Interceptor] receiver.js: got", punches.length, "today punches");
    window.dispatchEvent(
      new CustomEvent("TodayPunchesFromExtension", {
        detail: { punches },
      })
    );
    sendResponse({ success: true });
    return true;
  }
});

// Also check chrome.storage.local on page load for any pending data
chrome.storage.local.get(["lastInterceptedData", "lastInterceptedAt", "lastTodayPunches", "lastProfileData"], (result) => {
  if (result.lastInterceptedData) {
    const interceptedAt = new Date(result.lastInterceptedAt).getTime();
    const now = Date.now();
    // Only auto-inject if data is from the last 10 minutes
    if (now - interceptedAt < 10 * 60 * 1000) {
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
        if (result.lastProfileData) {
          window.dispatchEvent(
            new CustomEvent("ProfileDataFromExtension", {
              detail: { profile: result.lastProfileData },
            })
          );
        }
        if (result.lastTodayPunches) {
          window.dispatchEvent(
            new CustomEvent("TodayPunchesFromExtension", {
              detail: { punches: result.lastTodayPunches },
            })
          );
        }
      }, 1000);
    }
  }
});


// Listen for "Sync Now" request from the React app
window.addEventListener("RequestAttendanceSync", function (event) {
  const { employeeId, month, year } = event.detail || {};
  console.log("[Attendance Interceptor] receiver.js: Sync requested by app", { employeeId, month, year });

  chrome.runtime.sendMessage(
    {
      type: "FETCH_ATTENDANCE_REQUEST",
      payload: { employeeId, month, year },
    },
    (response) => {
      if (chrome.runtime.lastError) {
        console.error("[Attendance Interceptor] receiver.js: sync request failed:", chrome.runtime.lastError.message);
        window.dispatchEvent(
          new CustomEvent("ExtensionSyncStatus", {
            detail: { success: false, error: "Extension not responding" },
          })
        );
      } else {
        console.log("[Attendance Interceptor] receiver.js: sync request acknowledged:", response);
      }
    }
  );
});

// Signal to the app that the extension is present.
//
// IMPORTANT: a content script runs in an ISOLATED world. Setting
// `window.__attendanceExtensionReady` here is NOT visible to the page's own
// `window` (the React app reads a different window object), so the flag alone
// is unreliable. DOM CustomEvents, however, DO cross the isolated/main-world
// boundary because they dispatch on the shared DOM EventTarget.
//
// The event is also a one-shot: if it fires before React mounts and registers
// its listener, the app misses it and the Sync button stays disabled until
// something else (opening HROne) re-triggers a message. To close that race we
// re-dispatch the ready event a few times over the first few seconds so a
// late-mounting listener still catches it.
function announceReady() {
  window.dispatchEvent(new CustomEvent("AttendanceExtensionReady"));
}
// Set the isolated-world flag too (harmless; some code paths may read it).
window.__attendanceExtensionReady = true;
announceReady();
let readyPings = 0;
const readyPing = setInterval(() => {
  readyPings++;
  announceReady();
  if (readyPings >= 10) clearInterval(readyPing); // ~5s of coverage
}, 500);
})();
