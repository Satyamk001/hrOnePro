/**
 * pageWorld.js — Injected into the page's JS context.
 * Intercepts HROne attendance API responses via BOTH fetch and XMLHttpRequest.
 * Also intercepts EmployeeInformation API for profile data.
 *
 * Targets:
 * - /api/timeoffice/attendance/Calendar
 * - /api/workforce/Employee/EmployeeInformation/
 */
(function () {
  const ATTENDANCE_URL = "attendance/Calendar";
  const PROFILE_URL = "Employee/EmployeeInformation";

  function dispatchRecords(records, sourceUrl) {
    console.log(
      "[Attendance Interceptor] ✓ Dispatching",
      records.length,
      "records to content.js"
    );
    window.dispatchEvent(
      new CustomEvent("InterceptedAttendanceData", {
        detail: { records, sourceUrl },
      })
    );
  }

  function dispatchProfile(profile) {
    console.log(
      "[Attendance Interceptor] ✓ Dispatching profile for",
      profile.employeeName
    );
    window.dispatchEvent(
      new CustomEvent("InterceptedProfileData", {
        detail: { profile },
      })
    );
  }

  function tryExtractRecords(text, url) {
    try {
      const data = JSON.parse(text);
      let records = null;

      if (Array.isArray(data)) {
        records = data;
      } else if (data && typeof data === "object") {
        records = data.data || data.result || data.records || data.attendanceList;
        if (!Array.isArray(records)) records = null;
      }

      if (records && records.length > 0 && records[0].attendanceDate) {
        dispatchRecords(records, url);
        return true;
      }
    } catch (e) {
      // not JSON
    }
    return false;
  }

  function tryExtractProfile(text, url) {
    try {
      const data = JSON.parse(text);
      const arr = Array.isArray(data) ? data : [data];
      const info = arr[0];
      if (info && info.employeeName) {
        const profile = {
          employeeId: info.employeeId || 0,
          employeeCode: info.employeeCode || '',
          employeeName: info.employeeName || '',
          designation: info.designation || '',
          department: info.department || '',
          email: info.officialEmail || info.personalEmail || '',
          phone: info.mobileNo || '',
          dateOfJoining: info.dateOfJoining || '',
          reportingManager: info.reportingManager || '',
          profileImageUrl: info.imageVirtualPath || info.thumbnailFileName || null,
        };
        dispatchProfile(profile);
        return true;
      }
    } catch (e) {
      // not JSON
    }
    return false;
  }

  // === METHOD 1: Patch fetch ===
  function patchFetch() {
    const currentFetch = window.fetch;
    window.fetch = async function (...args) {
      const response = await currentFetch.apply(this, args);
      try {
        let url = "";
        if (typeof args[0] === "string") url = args[0];
        else if (args[0] && args[0].url) url = args[0].url;

        if (response.ok && url.includes(ATTENDANCE_URL)) {
          console.log("[Attendance Interceptor] fetch intercepted attendance:", url);
          const clone = response.clone();
          const text = await clone.text();
          tryExtractRecords(text, url);
        } else if (response.ok && url.includes(PROFILE_URL)) {
          console.log("[Attendance Interceptor] fetch intercepted profile:", url);
          const clone = response.clone();
          const text = await clone.text();
          tryExtractProfile(text, url);
        }
      } catch (err) {
        console.warn("[Attendance Interceptor] fetch patch error:", err);
      }
      return response;
    };
  }

  // === METHOD 2: Patch XMLHttpRequest ===
  function patchXHR() {
    const originalOpen = XMLHttpRequest.prototype.open;
    const originalSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function (method, url, ...rest) {
      this._interceptUrl = url;
      return originalOpen.apply(this, [method, url, ...rest]);
    };

    XMLHttpRequest.prototype.send = function (...args) {
      this.addEventListener("load", function () {
        try {
          if (this._interceptUrl && this.status >= 200 && this.status < 300) {
            if (this._interceptUrl.includes(ATTENDANCE_URL)) {
              console.log("[Attendance Interceptor] XHR intercepted attendance:", this._interceptUrl);
              tryExtractRecords(this.responseText, this._interceptUrl);
            } else if (this._interceptUrl.includes(PROFILE_URL)) {
              console.log("[Attendance Interceptor] XHR intercepted profile:", this._interceptUrl);
              tryExtractProfile(this.responseText, this._interceptUrl);
            }
          }
        } catch (err) {
          console.warn("[Attendance Interceptor] XHR intercept error:", err);
        }
      });
      return originalSend.apply(this, args);
    };
  }

  // Apply both patches
  patchFetch();
  patchXHR();

  // Re-patch fetch after a delay in case New Relic overwrites it
  setTimeout(patchFetch, 100);
  setTimeout(patchFetch, 500);
  setTimeout(patchFetch, 2000);

  console.log("[Attendance Interceptor] ✓ pageWorld.js loaded — fetch + XHR patched (attendance + profile)");
})();
