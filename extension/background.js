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
  "https://hronepro.vercel.app",
];

function isAppTab(tab) {
  if (!tab.url) return false;
  // Match localhost or 127.0.0.1
  if (APP_URL_PATTERNS.some((pattern) => tab.url.startsWith(pattern))) return true;
  // Match any http/https tab with "Attendance Insights" in title (for deployed versions)
  if ((tab.url.startsWith("http://") || tab.url.startsWith("https://")) && tab.title && tab.title.includes("Attendance Insights")) return true;
  return false;
}

// === Background sync tab tracking ===
// Tabs the extension itself opened to perform a "Sync Now" fetch. These are
// opened in the background (active: false) and should be closed automatically
// once the sync completes, errors out, or times out — so the user never sees
// a lingering HROne tab. We only ever close tabs we opened ourselves; tabs the
// user already had open are left untouched.
const syncOwnedTabs = new Set();

// Guards against double-closing (e.g. data arrives AND the timeout fires).
function closeSyncTab(tabId, reason) {
  if (!syncOwnedTabs.has(tabId)) return;
  syncOwnedTabs.delete(tabId);
  console.log("[Attendance Interceptor] Background: closing sync tab", tabId, "-", reason || "done");
  chrome.tabs.remove(tabId, () => {
    if (chrome.runtime.lastError) {
      // Tab may already be gone — not an error we care about.
      console.log("[Attendance Interceptor] Background: sync tab", tabId, "already closed");
    }
  });
}

// A HROne URL is considered "logged in and ready" only when it's on the actual
// app host. Login/SSO/identity redirects land elsewhere (e.g. identity.hrone,
// sso.hrone, or a /login path), which means the session has expired.
function isLoggedInHroneUrl(url) {
  if (!url) return false;
  if (!url.startsWith("https://app.hrone.cloud/app/")) return false;
  if (/\/(login|signin|sso|identity|auth)/i.test(url)) return false;
  return true;
}

// If a sync-owned tab is closed by any means, drop it from tracking so a
// recycled tab id can never be mistaken for one of ours.
chrome.tabs.onRemoved.addListener((tabId) => {
  syncOwnedTabs.delete(tabId);
});

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

    // If this data came from a tab we opened in the background for syncing,
    // close it now that we've captured the records.
    if (sender && sender.tab && sender.tab.id != null) {
      closeSyncTab(sender.tab.id, "attendance data received");
    }

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
    // receiver.js is now injected declaratively on every http/https host (it
    // self-gates to the app page), so no programmatic injection is needed here.

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
    chrome.tabs.query({ url: "https://*.hrone.cloud/*" }, (hroneTabs) => {
      // Prefer a tab that's actually on the app (not a login/SSO page)
      const appTab = hroneTabs.find((t) => t.url && t.url.startsWith("https://app.hrone.cloud/"));
      if (appTab) {
        // Use existing app tab — inject fetch script
        const tabId = appTab.id;
        console.log("[Attendance Interceptor] Background: Using existing HROne tab", tabId);
        injectFetchScript(tabId, eid, m, y);
      } else if (hroneTabs.length > 0) {
        // An HROne tab exists but it's on a login/SSO/other page — user likely
        // isn't logged into the app yet.
        notifyAppTabs({
          success: false,
          error: "Please log into HROne (app.hrone.cloud), then try Sync again.",
        });
      } else {
        // Open HROne in a background tab (active: false → doesn't steal focus).
        // The user never has to look at it. We detect three outcomes:
        //   1. Lands on app.hrone.cloud/app/... → logged in → fetch, then close.
        //   2. Redirects to a login/SSO page → not logged in → error, then close.
        //   3. Never finishes within the timeout → error, then close.
        console.log("[Attendance Interceptor] Background: Opening HROne tab in background...");
        chrome.tabs.create(
          { url: "https://app.hrone.cloud/app/myprofile/calendar", active: false },
          (tab) => {
            const createdTabId = tab.id;
            syncOwnedTabs.add(createdTabId);
            let settled = false;

            // Safety timeout: if HROne never finishes loading / responding,
            // don't leave the tab open forever.
            const timeout = setTimeout(() => {
              if (settled) return;
              settled = true;
              chrome.tabs.onUpdated.removeListener(listener);
              notifyAppTabs({
                success: false,
                error: "Timed out reaching HROne. Make sure you're logged in and try again.",
              });
              closeSyncTab(createdTabId, "timeout");
            }, 20000);

            function listener(tabId, changeInfo, updatedTab) {
              if (tabId !== createdTabId || changeInfo.status !== "complete") return;
              if (settled) return;

              const finalUrl = (updatedTab && updatedTab.url) || "";
              if (!isLoggedInHroneUrl(finalUrl)) {
                // Redirected to login/SSO — session expired or never signed in.
                settled = true;
                clearTimeout(timeout);
                chrome.tabs.onUpdated.removeListener(listener);
                console.log("[Attendance Interceptor] Background: HROne not logged in, landed on", finalUrl);
                notifyAppTabs({
                  success: false,
                  error: "Not logged in to HROne. Please log into app.hrone.cloud, then try Sync again.",
                });
                closeSyncTab(createdTabId, "not logged in");
                return;
              }

              // Logged in and on the app — proceed to fetch. The tab stays in
              // syncOwnedTabs and is closed by the ATTENDANCE_DATA_INTERCEPTED
              // handler once records arrive. Clear the load listener; keep a
              // shorter fetch timeout so a stuck fetch still closes the tab.
              settled = true;
              clearTimeout(timeout);
              chrome.tabs.onUpdated.removeListener(listener);
              setTimeout(() => {
                injectFetchScript(createdTabId, eid, m, y);
              }, 2000);

              // Fallback close in case the fetch yields no ATTENDANCE_DATA
              // message (e.g. no records for the month) — don't orphan the tab.
              setTimeout(() => {
                closeSyncTab(createdTabId, "fetch fallback timeout");
              }, 15000);
            }

            chrome.tabs.onUpdated.addListener(listener);
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
        // Translate Chrome's cryptic host-permission error into a clear,
        // actionable message. This happens when the HROne tab has navigated
        // to a login/SSO page (a host the extension can't script), which
        // usually means the user's session expired or HROne was slow.
        const msg = err.message || "";
        const friendly = /Cannot access contents of the page|must request permission/i.test(msg)
          ? "Please log into HROne (app.hrone.cloud), then try Sync again."
          : "Couldn't reach HROne. Make sure you're logged in and try again.";
        notifyAppTabs({ success: false, error: friendly });
        closeSyncTab(tabId, "fetch inject failed");
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
