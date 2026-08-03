/**
 * content.js — Content script injected into the attendance portal pages.
 * 1. Injects pageWorld.js into the page's main world to patch fetch.
 * 2. Listens for the "InterceptedAttendanceData" custom event.
 * 3. Forwards captured data to the background service worker.
 */

// Step 1: Inject pageWorld.js into the page's JS context
const script = document.createElement("script");
script.src = chrome.runtime.getURL("pageWorld.js");
script.onload = function () {
  console.log("[Attendance Interceptor] content.js: pageWorld.js injected successfully");
  this.remove(); // Clean up after injection
};
script.onerror = function () {
  console.error("[Attendance Interceptor] content.js: FAILED to inject pageWorld.js");
};
(document.head || document.documentElement).appendChild(script);

// Step 2: Listen for intercepted data from pageWorld.js
window.addEventListener("InterceptedAttendanceData", function (event) {
  const { records, sourceUrl } = event.detail;

  console.log(
    "[Attendance Interceptor] content.js: received",
    records.length,
    "records, forwarding to background..."
  );

  // Step 3: Forward to background service worker
  try {
    chrome.runtime.sendMessage(
      {
        type: "ATTENDANCE_DATA_INTERCEPTED",
        payload: { records, sourceUrl },
      },
      (response) => {
        if (chrome.runtime.lastError) {
          console.warn("[Attendance Interceptor] content.js: sendMessage failed (extension may have been reloaded). Refresh this page.");
        } else {
          console.log("[Attendance Interceptor] content.js: background acknowledged:", response);
        }
      }
    );
  } catch (e) {
    console.warn("[Attendance Interceptor] content.js: Extension context invalidated. Refresh this page.");
  }
});

// Listen for profile data
window.addEventListener("InterceptedProfileData", function (event) {
  const { profile } = event.detail;

  console.log(
    "[Attendance Interceptor] content.js: received profile for",
    profile.employeeName,
    ", forwarding to background..."
  );

  try {
    chrome.runtime.sendMessage(
      {
        type: "PROFILE_DATA_INTERCEPTED",
        payload: { profile },
      },
      (response) => {
        if (chrome.runtime.lastError) {
          console.warn("[Attendance Interceptor] content.js: profile sendMessage failed (extension reloaded?).");
        } else {
          console.log("[Attendance Interceptor] content.js: background acknowledged profile:", response);
        }
      }
    );
  } catch (e) {
    console.warn("[Attendance Interceptor] content.js: Extension context invalidated for profile send.");
  }
});

console.log("[Attendance Interceptor] content.js loaded on:", window.location.href);


// Listen for today's punch data
window.addEventListener("InterceptedTodayPunches", function (event) {
  const { punches } = event.detail;
  console.log("[Attendance Interceptor] content.js: received", punches.length, "punches for today");
  try {
    chrome.runtime.sendMessage(
      { type: "TODAY_PUNCHES_INTERCEPTED", payload: { punches } },
      (response) => {
        if (chrome.runtime.lastError) {
          console.warn("[Attendance Interceptor] content.js: punch sendMessage failed");
        }
      }
    );
  } catch (e) {
    console.warn("[Attendance Interceptor] content.js: Extension context invalidated for punch send.");
  }
});
