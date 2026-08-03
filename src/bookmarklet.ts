/**
 * Generates the bookmarklet code string.
 * The bookmarklet fetches attendance data and employee profile from HROne
 * and sends both to the attendance-insights app via postMessage.
 */
export function generateBookmarkletCode(appUrl: string, version: string): string {
  return `javascript:void((function(){
var BV='${version}';
var u='${appUrl}';
if(!location.hostname.includes('hrone.cloud')){alert('Run this on HROne portal');return}
var y,m;
try{
var sel=document.querySelector('select[class*=month],select[class*=attendance],.ant-select-selection-item,[class*=CalendarDropdown] select');
if(sel){var txt=sel.value||sel.textContent||sel.innerText;var parts=txt.match(/(\\w+)[,\\s]+(\\d{4})/);if(parts){var months={jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12};m=months[parts[1].toLowerCase().substring(0,3)];y=parseInt(parts[2])}}
if(!m||!y){var allText=document.body.innerText;var match=allText.match(/Attendance for[:\\s]*(\\w+)[,\\s]+(\\d{4})/i);if(match){var months2={jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12};m=months2[match[1].toLowerCase().substring(0,3)];y=parseInt(match[2])}}
}catch(e){}
if(!m||!y){var d=new Date();y=d.getFullYear();m=d.getMonth()+1}
var eid=0;
try{
eid=parseInt(localStorage.getItem('attendance-empId'))||0;
if(!eid){var keys=Object.keys(localStorage);for(var k=0;k<keys.length;k++){var v=localStorage.getItem(keys[k]);if(v&&v.indexOf('employeeId')>-1){try{var o=JSON.parse(v);eid=parseInt(o.employeeId||o.EmployeeId)||0}catch(e){}}if(eid)break}}
if(!eid)eid=parseInt(prompt('Enter your Employee ID (find it in HROne profile):')||'0');
}catch(e){eid=parseInt(prompt('Enter your Employee ID:')||'0')}
if(!eid){alert('Employee ID required');return}
localStorage.setItem('attendance-empId',String(eid));
var userName='';
try{var nameEl=document.body.innerText.match(/([A-Z][a-z]+ [A-Z][a-z]+)\\s*\\(#[A-Z0-9]+\\)/);if(nameEl)userName=nameEl[1];if(!userName){var h=document.querySelector('h1,h2,h3,.employee-name,.user-name,[class*=employeeName],[class*=userName]');if(h)userName=h.textContent.trim().split('(')[0].trim()}}catch(e){}
var empProfile=null;
var records=null;
var profileDone=false;
var attendanceDone=false;
var hdrs={'Content-Type':'application/json','Accept':'application/json, text/plain, */*','domaincode':'mapmyindia','accessmode':'W','x-requested-with':location.origin,'cache-control':'no-cache','pragma':'no-cache'};
function trySend(){
if(!attendanceDone||!profileDone)return;
if(!records||!records.length)return;
var w=window.open(u,'attendance-insights');
var i=0;
var s=function(){i++;try{w.postMessage({type:'ATTENDANCE_DATA',records:records,userName:userName,employeeId:eid,profile:empProfile,v:BV},'*');console.log('[Attendance Insights] Sent data, profile:',empProfile?'yes':'no')}catch(e){}if(i<15)setTimeout(s,500)};
setTimeout(s,1000);
}
setTimeout(function(){if(!profileDone){profileDone=true;console.log('[Attendance Insights] Profile fetch timed out');trySend()}},5000);
fetch(location.origin+'/api/workforce/Employee/EmployeeInformation/'+eid,{method:'GET',headers:hdrs,credentials:'include'}).then(function(r){console.log('[Attendance Insights] Profile API status:',r.status);return r.ok?r.json():null}).then(function(data){if(data){var arr=Array.isArray(data)?data:[data];var info=arr[0];if(info){empProfile={employeeId:eid,employeeCode:info.employeeCode||'',employeeName:info.employeeName||userName||'',designation:info.designation||'',department:info.department||'',email:info.officialEmail||info.personalEmail||'',phone:info.mobileNo||'',dateOfJoining:info.dateOfJoining||'',reportingManager:info.reportingManager||'',profileImageUrl:info.imageVirtualPath||info.thumbnailFileName||null};console.log('[Attendance Insights] Profile parsed:',empProfile.employeeName)}}}).catch(function(e){console.log('[Attendance Insights] Profile fetch error:',e)}).then(function(){profileDone=true;trySend()});
fetch(location.origin+'/api/timeoffice/attendance/Calendar',{method:'POST',headers:hdrs,credentials:'include',body:JSON.stringify({attendanceYear:y,attendanceMonth:m,employeeId:eid,calendarViewType:'C'})}).then(function(r){if(!r.ok)throw new Error('HTTP '+r.status);return r.text()}).then(function(text){if(!text)throw new Error('Empty response');var data=JSON.parse(text);records=Array.isArray(data)?data:(data.data||data.result||[]);if(!records.length){alert('No records found for '+m+'/'+y);return}attendanceDone=true;trySend()}).catch(function(e){alert('Error: '+e.message+'\\n\\nMake sure you are logged in to HROne.')});
})())`.replace(/\n/g, '');
}
