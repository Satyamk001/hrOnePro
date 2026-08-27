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


// Handle "Sync Now" request from background — fetch attendance directly from this HROne page
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "FETCH_ATTENDANCE_NOW") {
    const { employeeId, month, year } = message.payload;
    console.log("[Attendance Interceptor] content.js: Fetching attendance for", employeeId, month, year);

    const hdrs = {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/plain, */*',
      'domaincode': 'mapmyindia',
      'accessmode': 'W',
      'x-requested-with': location.origin,
      'cache-control': 'no-cache',
      'pragma': 'no-cache'
    };

    let profileDone = false;
    let attendanceDone = false;
    let punchDone = false;

    // Fetch profile
    fetch(location.origin + '/api/workforce/Employee/EmployeeInformation/' + employeeId, {
      method: 'GET', headers: hdrs, credentials: 'include'
    }).then(r => r.ok ? r.json() : null).then(data => {
      if (data) {
        const arr = Array.isArray(data) ? data : [data];
        const info = arr[0];
        if (info) {
          const profile = {
            employeeId: employeeId,
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
          try { chrome.runtime.sendMessage({ type: "PROFILE_DATA_INTERCEPTED", payload: { profile } }); } catch(e) {}
        }
      }
    }).catch(() => {}).then(() => { profileDone = true; });

    // Fetch attendance
    fetch(location.origin + '/api/timeoffice/attendance/Calendar', {
      method: 'POST', headers: hdrs, credentials: 'include',
      body: JSON.stringify({ attendanceYear: year, attendanceMonth: month, employeeId: employeeId, calendarViewType: 'C' })
    }).then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); })
    .then(text => {
      const data = JSON.parse(text);
      const records = Array.isArray(data) ? data : (data.data || data.result || []);
      if (records.length > 0) {
        try { chrome.runtime.sendMessage({ type: "ATTENDANCE_DATA_INTERCEPTED", payload: { records, sourceUrl: "sync-now" } }); } catch(e) {}
      }
    }).catch(err => {
      console.error("[Attendance Interceptor] content.js: fetch attendance error:", err.message);
    }).then(() => { attendanceDone = true; });

    // Fetch today's punches
    const today = new Date().toISOString().split('T')[0];
    fetch(location.origin + '/api/timeoffice/attendance/RawPunch/' + employeeId + '/' + today + '/true', {
      method: 'GET', headers: hdrs, credentials: 'include'
    }).then(r => r.ok ? r.json() : null).then(data => {
      if (data && Array.isArray(data) && data.length > 0) {
        try { chrome.runtime.sendMessage({ type: "TODAY_PUNCHES_INTERCEPTED", payload: { punches: data } }); } catch(e) {}
      }
    }).catch(() => {}).then(() => { punchDone = true; });

    sendResponse({ success: true });
    return true;
  }
});
