const ADMIN_CODE='Administrator';
const DEFAULT_VISITOR_CODE='KDKR1105';
const OLD_DEFAULT_NAMES=['Алексей','Мария','Иван','Екатерина','Сергей','Анна','Павел','Виктория','Дмитрий','Елена','Николай','Ольга','Владимир'];
let appData={members:[],attendance:{}};
let isAdmin=false;
let visitorUnlocked=false;

function init(){
 loadData(); bindEvents();
 document.getElementById('app').hidden=true;
 document.getElementById('visitorGate').hidden=false;
}
function loadData(){
 try{appData=JSON.parse(localStorage.getItem('attendanceData'))||{members:[],attendance:{}};}catch{appData={members:[],attendance:{}};}
 appData.members=appData.members||[]; appData.attendance=appData.attendance||{};
 if(appData.members.length===OLD_DEFAULT_NAMES.length&&appData.members.every(m=>OLD_DEFAULT_NAMES.includes(m.name))){appData.members=[];saveData();}
 if(!localStorage.getItem('visitorAccessCode'))localStorage.setItem('visitorAccessCode',DEFAULT_VISITOR_CODE);
}
function saveData(){localStorage.setItem('attendanceData',JSON.stringify(appData));}
function bindEvents(){
 document.getElementById('visitorLoginForm').addEventListener('submit',visitorLogin);
 document.getElementById('adminLoginBtn').addEventListener('click',adminLogin);
 document.getElementById('adminPassword').addEventListener('keydown',e=>{if(e.key==='Enter')adminLogin();});
 document.getElementById('changeVisitorPasswordBtn').addEventListener('click',changeVisitorPassword);
 document.getElementById('addMemberBtn').addEventListener('click',addMember);
 document.getElementById('newMemberInput').addEventListener('keydown',e=>{if(e.key==='Enter')addMember();});
 document.getElementById('dateInput').addEventListener('change',renderAttendance);
 document.getElementById('sortSelect').addEventListener('change',renderAttendance);
 document.getElementById('generateReportBtn').addEventListener('click',generateReport);
}
function visitorLogin(e){
 e.preventDefault();
 const input=document.getElementById('visitorPassword');
 if(input.value===localStorage.getItem('visitorAccessCode')){visitorUnlocked=true;document.getElementById('visitorGate').hidden=true;document.getElementById('app').hidden=false;setDates();updateAdminUI();renderAttendance();renderMembers();}
 else{document.getElementById('visitorLoginError').hidden=false;input.select();}
}
function setDates(){const today=new Date().toISOString().slice(0,10),d=new Date();document.getElementById('dateInput').value=today;document.getElementById('startDate').value=new Date(d.getFullYear(),d.getMonth(),1).toISOString().slice(0,10);document.getElementById('endDate').value=today;}
function adminLogin(){const input=document.getElementById('adminPassword');if(input.value===ADMIN_CODE){isAdmin=true;input.value='';updateAdminUI();}else{isAdmin=false;input.value='';updateAdminUI();alert('Неверный код администратора');}}
function updateAdminUI(){
 const input=document.getElementById('newMemberInput'),button=document.getElementById('addMemberBtn');input.disabled=!isAdmin;button.disabled=!isAdmin;
 const status=document.getElementById('adminStatus');status.textContent=isAdmin?'Доступ открыт':'Доступ закрыт';status.classList.toggle('unlocked',isAdmin);
 document.getElementById('adminHint').hidden=isAdmin;document.getElementById('changeVisitorPassword').hidden=!isAdmin;renderMembers();renderAttendance();
}
function changeVisitorPassword(){if(!isAdmin)return;const field=document.getElementById('newVisitorPassword'),value=field.value.trim(),message=document.getElementById('passwordChangeMessage');if(value.length<4){message.textContent='Пароль должен содержать минимум 4 символа';return;}localStorage.setItem('visitorAccessCode',value);field.value='';message.textContent='Пароль посетителя изменён';setTimeout(()=>message.textContent='',3000);}
function renderMembers(){const list=document.getElementById('membersList');list.innerHTML='';if(!appData.members.length){list.innerHTML='<p class="empty-message">Участники ещё не добавлены.</p>';return;}appData.members.forEach(m=>{const item=document.createElement('div');item.className='member-item';item.innerHTML=`<span class="member-name">${escapeHtml(m.name)}</span><div class="member-actions">${isAdmin?`<button class="btn btn-edit" onclick="editMember(${m.id})">Изменить</button><button class="btn btn-danger" onclick="deleteMember(${m.id})">Удалить</button>`:'<span class="admin-only-label">Только администратор</span>'}</div>`;list.appendChild(item);});}
function renderAttendance(){const body=document.getElementById('attendanceTableBody');if(!body)return;body.innerHTML='';const date=document.getElementById('dateInput').value;sortMembers([...appData.members],document.getElementById('sortSelect').value).forEach((m,i)=>{const value=appData.attendance[date]?.[m.id]||'';const row=document.createElement('tr');row.innerHTML=`<td>${i+1}</td><td>${escapeHtml(m.name)}</td><td class="status-cell"><button class="status-btn ${value==='present'?'active-success':''}" onclick="setAttendance(${m.id},'present')">✓</button></td><td class="status-cell"><button class="status-btn ${value==='absent'?'active-error':''}" onclick="setAttendance(${m.id},'absent')">✗</button></td><td class="status-cell"><button class="status-btn ${value==='valid_absent'?'active-warning':''}" onclick="setAttendance(${m.id},'valid_absent')">⚠</button></td><td class="status-cell">${isAdmin?`<button class="btn btn-danger" onclick="clearAttendance(${m.id})">Сбросить</button>`:'<span class="admin-only-label">Только администратор</span>'}</td>`;body.appendChild(row);});}
function sortMembers(a,type){const s=allStats();if(type==='name')return a.sort((x,y)=>x.name.localeCompare(y.name,'ru'));if(type==='name-desc')return a.sort((x,y)=>y.name.localeCompare(x.name,'ru'));if(type==='absent-most')return a.sort((x,y)=>s[y.id].absent-s[x.id].absent);if(type==='present-most')return a.sort((x,y)=>s[y.id].present-s[x.id].present);return a;}
function setAttendance(id,value){const date=document.getElementById('dateInput').value;appData.attendance[date]=appData.attendance[date]||{};appData.attendance[date][id]=appData.attendance[date][id]===value?null:value;saveData();renderAttendance();}
function clearAttendance(id){if(!isAdmin)return;const d=document.getElementById('dateInput').value;if(appData.attendance[d])appData.attendance[d][id]=null;saveData();renderAttendance();}
function addMember(){if(!isAdmin)return;const input=document.getElementById('newMemberInput'),name=input.value.trim();if(!name)return alert('Пожалуйста, введите имя');if(appData.members.some(m=>m.name.toLowerCase()===name.toLowerCase()))return alert('Такой участник уже есть');appData.members.push({id:Math.max(-1,...appData.members.map(m=>m.id))+1,name});input.value='';saveData();renderMembers();renderAttendance();}
function editMember(id){if(!isAdmin)return;const m=appData.members.find(x=>x.id===id),name=prompt('Введите новое имя:',m.name);if(name&&name.trim()){m.name=name.trim();saveData();renderMembers();renderAttendance();}}
function deleteMember(id){if(!isAdmin||!confirm('Удалить участника? Это действие нельзя отменить.'))return;appData.members=appData.members.filter(m=>m.id!==id);Object.values(appData.attendance).forEach(d=>delete d[id]);saveData();renderMembers();renderAttendance();}
function statsFor(id,start,end){const r={present:0,absent:0,valid_absent:0};for(let d=new Date(start);d<=new Date(end);d.setDate(d.getDate()+1)){const v=appData.attendance[d.toISOString().slice(0,10)]?.[id];if(v)r[v]++;}return r;}
function allStats(){const today=new Date().toISOString().slice(0,10),start=document.getElementById('startDate')?.value||today,end=document.getElementById('endDate')?.value||today;return Object.fromEntries(appData.members.map(m=>[m.id,statsFor(m.id,start,end)]));}
function generateReport(){const start=document.getElementById('startDate').value,end=document.getElementById('endDate').value;if(!start||!end)return alert('Пожалуйста, выберите период');const s=allStats(),body=document.getElementById('analyticsTableBody');body.innerHTML='';[...appData.members].sort((a,b)=>a.name.localeCompare(b.name,'ru')).forEach(m=>{const x=s[m.id],total=x.present+x.absent+x.valid_absent,p=total?Math.round(x.present/total*100):0,row=document.createElement('tr');row.innerHTML=`<td>${escapeHtml(m.name)}</td><td>${x.present}</td><td>${x.absent}</td><td>${x.valid_absent}</td><td>${p}%</td>`;body.appendChild(row);});renderTop('topAbsentList',s,'absent','Отсутствий:','Нет данных об отсутствиях','error');renderTop('topAbsentValidList',s,'valid_absent','Уважительных причин:','Нет данных об уважительных причинах','warning');}
function renderTop(id,s,key,label,empty,type){const items=appData.members.map(m=>({m,c:s[m.id][key]})).filter(x=>x.c>0).sort((a,b)=>b.c-a.c).slice(0,3),list=document.getElementById(id);list.innerHTML=items.length?items.map((x,i)=>`<div class="top-item ${type}"><b class="top-rank ${type}">${i+1}.</b><div><b>${escapeHtml(x.m.name)}</b><div class="top-count">${label} ${x.c}</div></div></div>`).join(''):`<p class="empty-message">${empty}</p>`;}
function escapeHtml(v){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));}
document.addEventListener('DOMContentLoaded',init);