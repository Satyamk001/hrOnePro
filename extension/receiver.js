/**
 * receiver.js — Content script injected into the React app (localhost).
 * Receives attendance data from the background service worker
 * and dispatches it as a custom DOM event for the React app to consume.
 */

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

// Signal to the app that the extension is present
window.dispatchEvent(new CustomEvent("AttendanceExtensionReady"));
// Also set a flag on the window that the app can check
window.__attendanceExtensionReady = true;
