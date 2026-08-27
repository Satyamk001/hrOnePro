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
  // Match any http/https tab with "Attendance Insights" in title (for deployed versions)
  if ((tab.url.startsWith("http://") || tab.url.startsWith("https://")) && tab.title && tab.title.includes("Attendance Insights")) return true;
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

    // Find the React app tab and forward data (include stored profile if available)
    chrome.storage.local.get(["lastProfileData"], (profileResult) => {
      const profile = profileResult.lastProfileData || null;

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
              { type: "ATTENDANCE_DATA_RECEIVED", payload: { records, profile } },
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
    });

    sendResponse({ success: true, recordCount: records.length });
    return true;
  }

  if (message.type === "PROFILE_DATA_INTERCEPTED") {
    const { profile } = message.payload;

    console.log(
      "[Attendance Interceptor] Background: received profile for",
      profile.employeeName
    );

    // Store profile persistently
    chrome.storage.local.set({ lastProfileData: profile });

    // Also forward to app tab immediately
    chrome.tabs.query({}, (allTabs) => {
      const appTabs = allTabs.filter(isAppTab);
      for (const tab of appTabs) {
        chrome.tabs.sendMessage(
          tab.id,
          { type: "PROFILE_DATA_RECEIVED", payload: { profile } },
          (response) => {
            if (chrome.runtime.lastError) {
              // tab might not have receiver.js yet
            }
          }
        );
      }
    });

    sendResponse({ success: true });
    return true;
  }

  if (message.type === "TODAY_PUNCHES_INTERCEPTED") {
    const { punches } = message.payload;

    console.log("[Attendance Interceptor] Background: received", punches.length, "today punches");

    chrome.storage.local.set({ lastTodayPunches: punches, lastTodayPunchesAt: new Date().toISOString() });

    // Forward to app tabs
    chrome.tabs.query({}, (allTabs) => {
      const appTabs = allTabs.filter(isAppTab);
      for (const tab of appTabs) {
        chrome.tabs.sendMessage(
          tab.id,
          { type: "TODAY_PUNCHES_RECEIVED", payload: { punches } },
          () => { if (chrome.runtime.lastError) { /* ignore */ } }
        );
      }
    });

    sendResponse({ success: true });
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


// Handle "Sync Now" request from the app via receiver.js
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "FETCH_ATTENDANCE_REQUEST") {
    const { employeeId, month, year } = message.payload;
    const eid = employeeId || 0;
    const m = month || new Date().getMonth() + 1;
    const y = year || new Date().getFullYear();

    console.log("[Attendance Interceptor] Background: Sync Now requested for", eid, m, y);

    if (!eid) {
      notifyAppTabs({ success: false, error: "No employee ID configured" });
      sendResponse({ success: false, error: "No employee ID" });
      return true;
    }

    // Find an existing HROne tab or create one
    chrome.tabs.query({ url: "https://app.hrone.cloud/*" }, (hroneTabs) => {
      if (hroneTabs.length > 0) {
        // Use existing tab — inject fetch script
        const tabId = hroneTabs[0].id;
        console.log("[Attendance Interceptor] Background: Using existing HROne tab", tabId);
        injectFetchScript(tabId, eid, m, y);
      } else {
        // Open HROne in background — user must be logged in
        console.log("[Attendance Interceptor] Background: Opening HROne tab...");
        chrome.tabs.create(
          { url: "https://app.hrone.cloud/app/myprofile/calendar", active: false },
          (tab) => {
            // Wait for the tab to finish loading
            chrome.tabs.onUpdated.addListener(function listener(tabId, changeInfo) {
              if (tabId === tab.id && changeInfo.status === "complete") {
                chrome.tabs.onUpdated.removeListener(listener);
                // Small delay to let HROne JS initialize
                setTimeout(() => {
                  injectFetchScript(tab.id, eid, m, y);
                }, 2000);
              }
            });
          }
        );
      }
    });

    sendResponse({ success: true, message: "Sync initiated" });
    return true;
  }
});

function injectFetchScript(tabId, eid, month, year) {
  // Send a message to the content script already running on HROne
  chrome.tabs.sendMessage(tabId, {
    type: "FETCH_ATTENDANCE_NOW",
    payload: { employeeId: eid, month, year }
  }, (response) => {
    if (chrome.runtime.lastError) {
      // Content script not ready yet — try scripting API as fallback
      chrome.scripting.executeScript({
        target: { tabId },
        func: fetchAttendanceFromHROne,
        args: [eid, month, year],
      }).catch((err) => {
        console.error("[Attendance Interceptor] Background: inject failed:", err.message);
        notifyAppTabs({ success: false, error: "Failed to connect to HROne: " + err.message });
      });
    } else {
      console.log("[Attendance Interceptor] Background: content script handling fetch", response);
    }
  });
}

// This function runs inside the HROne tab context
function fetchAttendanceFromHROne(eid, month, year) {
  const hdrs = {
    'Content-Type': 'application/json',
    'Accept': 'application/json, text/plain, */*',
    'domaincode': 'mapmyindia',
    'accessmode': 'W',
    'x-requested-with': location.origin,
    'cache-control': 'no-cache',
    'pragma': 'no-cache'
  };

  let empProfile = null;
  let records = null;
  let todayPunches = null;
  let profileDone = false;
  let attendanceDone = false;
  let punchDone = false;

  function trySend() {
    if (!attendanceDone || !profileDone || !punchDone) return;
    // Send results back to background via custom event → content.js
    window.dispatchEvent(new CustomEvent("InterceptedAttendanceData", {
      detail: { records: records || [], sourceUrl: "sync-now" }
    }));
    if (empProfile) {
      window.dispatchEvent(new CustomEvent("InterceptedProfileData", {
        detail: { profile: empProfile }
      }));
    }
    if (todayPunches && todayPunches.length > 0) {
      window.dispatchEvent(new CustomEvent("InterceptedTodayPunches", {
        detail: { punches: todayPunches }
      }));
    }
  }

  // Fetch profile
  fetch(location.origin + '/api/workforce/Employee/EmployeeInformation/' + eid, {
    method: 'GET', headers: hdrs, credentials: 'include'
  }).then(r => r.ok ? r.json() : null).then(data => {
    if (data) {
      const arr = Array.isArray(data) ? data : [data];
      const info = arr[0];
      if (info) {
        empProfile = {
          employeeId: eid,
          employeeCode: info.employeeCode || '',
          employeeName: info.employeeName || '',
          designation: info.designation || '',
          department: info.department || '',
          email: info.officialEmail || info.personalEmail || '',
          phone: info.mobileNo || '',
          dateOfJoining: info.dateOfJoining || '',
          reportingManager: info.reportingManager || '',
          profileImageUrl: info.imageVirtualPath || info.thumbnailFileName || null
        };
      }
    }
  }).catch(() => {}).then(() => { profileDone = true; trySend(); });

  // Fetch attendance
  fetch(location.origin + '/api/timeoffice/attendance/Calendar', {
    method: 'POST', headers: hdrs, credentials: 'include',
    body: JSON.stringify({ attendanceYear: year, attendanceMonth: month, employeeId: eid, calendarViewType: 'C' })
  }).then(r => {
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.text();
  }).then(text => {
    const data = JSON.parse(text);
    records = Array.isArray(data) ? data : (data.data || data.result || []);
    if (!records.length) {
      console.log('[Attendance Interceptor] Sync Now: no records found');
    }
    attendanceDone = true;
    trySend();
  }).catch(err => {
    console.error('[Attendance Interceptor] Sync Now fetch error:', err.message);
    attendanceDone = true;
    trySend();
  });

  // Fetch today's raw punches
  const today = new Date().toISOString().split('T')[0];
  fetch(location.origin + '/api/timeoffice/attendance/RawPunch/' + eid + '/' + today + '/true', {
    method: 'GET', headers: hdrs, credentials: 'include'
  }).then(r => r.ok ? r.json() : null).then(data => {
    if (data && Array.isArray(data) && data.length > 0) {
      todayPunches = data;
    }
  }).catch(() => {}).then(() => { punchDone = true; trySend(); });
}

function notifyAppTabs(payload) {
  chrome.tabs.query({}, (allTabs) => {
    const appTabs = allTabs.filter(isAppTab);
    for (const tab of appTabs) {
      chrome.tabs.sendMessage(tab.id, { type: "SYNC_STATUS", payload });
    }
  });
}
