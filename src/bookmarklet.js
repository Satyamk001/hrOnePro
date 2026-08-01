/**
 * Bookmarklet source code (not bundled — this is the raw JS that gets minified into the bookmarklet URL).
 * 
 * Usage: User clicks this bookmark while on app.hrone.cloud
 * It fetches attendance data for the current month using their session,
 * then opens the Attendance Insights app and sends the data via postMessage.
 *
 * IMPORTANT: Update APP_URL to match your deployed React app URL.
 */
(function() {
  var APP_URL = 'http://localhost:3333';
  
  // Get current month/year
  var now = new Date();
  var year = now.getFullYear();
  var month = now.getMonth() + 1;

  // Check if we're on HROne
  if (!window.location.hostname.includes('hrone.cloud')) {
    alert('Please run this bookmarklet on the HROne portal (app.hrone.cloud)');
    return;
  }

  // Extract employee ID from JWT cookie
  var employeeId = 0;
  try {
    var cookies = document.cookie.split(';');
    for (var i = 0; i < cookies.length; i++) {
      var c = cookies[i].trim();
      if (c.startsWith('JwtTokenCookie=')) {
        var token = c.substring('JwtTokenCookie='.length);
        var payload = JSON.parse(atob(token.split('.')[1]));
        employeeId = parseInt(payload.LogOnId || payload.Uid || '0');
        break;
      }
    }
  } catch(e) {}

  // Show loading indicator
  var overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:99999;display:flex;align-items:center;justify-content:center;';
  overlay.innerHTML = '<div style="background:white;padding:20px 40px;border-radius:8px;font-family:sans-serif;"><p style="margin:0;font-size:16px;">Fetching attendance data...</p></div>';
  document.body.appendChild(overlay);

  // Fetch attendance for current month
  fetch('/api/timeoffice/attendance/Calendar', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'domaincode': window.location.hostname.includes('hrone') ? document.cookie.match(/domaincode=([^;]*)/)?.[1] || 'mapmyindia' : 'mapmyindia',
      'accessmode': 'W',
      'x-requested-with': window.location.origin
    },
    credentials: 'include',
    body: JSON.stringify({
      attendanceYear: year,
      attendanceMonth: month,
      employeeId: employeeId,
      calendarViewType: 'C'
    })
  })
  .then(function(res) { return res.json(); })
  .then(function(data) {
    document.body.removeChild(overlay);

    var records = Array.isArray(data) ? data : (data.data || data.result || data.records || []);
    
    if (!records.length) {
      alert('No attendance records found for ' + month + '/' + year);
      return;
    }

    // Open the app and send data via postMessage
    var appWindow = window.open(APP_URL, 'attendance-insights');
    
    // Wait for the app to load, then send data
    var attempts = 0;
    var sendData = function() {
      attempts++;
      if (attempts > 30) {
        alert('Could not connect to Attendance Insights app. Is it running at ' + APP_URL + '?');
        return;
      }
      try {
        appWindow.postMessage({ type: 'ATTENDANCE_DATA', records: records }, APP_URL);
      } catch(e) {}
      // Keep trying in case the app hasn't loaded yet
      if (attempts < 10) {
        setTimeout(sendData, 500);
      }
    };
    
    // Start sending after a short delay for the page to load
    setTimeout(sendData, 1000);
    
    alert('✓ Sent ' + records.length + ' records to Attendance Insights!');
  })
  .catch(function(err) {
    document.body.removeChild(overlay);
    alert('Error fetching attendance: ' + err.message);
  });
})();
