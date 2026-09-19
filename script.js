const SUPABASE_URL = 'https://ycsyatkxzxilrikbirip.supabase.co';
const SUPABASE_KEY = 'sb_publishable_rhtW_9wSVx4YtW5KPnybnA_6Nu8w2ST';
const DEFAULT_VISITOR_PASSWORD = 'KDKR1105';
const ADMIN_CODE = 'Administrator';
let client = null;
let appData = { members: [], attendance: {} };
let isAdmin = false;

function $(id) { return document.getElementById(id); }
function showError(message) { console.error(message); const el = $('visitorLoginError'); if (el) { el.textContent = message; el.hidden = false; } }
function escapeHtml(value) { return String(value).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;' }[c])); }

function init() {
    client = window.supabase?.createClient(SUPABASE_URL, SUPABASE_KEY) || null;
    $('app').hidden = true;
    $('visitorGate').hidden = false;
    $('visitorLoginForm').addEventListener('submit', visitorLogin);
    $('adminLoginBtn').addEventListener('click', adminLogin);
    $('adminPassword').addEventListener('keydown', e => { if (e.key === 'Enter') adminLogin(); });
    $('changeVisitorPasswordBtn').addEventListener('click', changeVisitorPassword);
    $('addMemberBtn').addEventListener('click', addMember);
    $('newMemberInput').addEventListener('keydown', e => { if (e.key === 'Enter') addMember(); });
    $('dateInput').addEventListener('change', renderAttendance);
    $('sortSelect').addEventListener('change', renderAttendance);
    $('generateReportBtn').addEventListener('click', generateReport);
    setDates();
}

async function visitorLogin(event) {
    event.preventDefault();
    const input = $('visitorPassword');
    const button = event.target.querySelector('button[type="submit"]');
    const entered = input.value.trim();
    button.disabled = true;
    $('visitorLoginError').hidden = true;

    try {
        let password = DEFAULT_VISITOR_PASSWORD;
        // A network/table error must not prevent the initial default password from working.
        if (client) {
            const result = await client.from('settings').select('value').eq('key', 'visitor_password').maybeSingle();
            if (!result.error && result.data?.value) password = String(result.data.value).trim();
            else if (result.error && !['42P01', 'PGRST116', '42501'].includes(result.error.code)) console.warn(result.error);
        }
        if (entered !== password && entered !== DEFAULT_VISITOR_PASSWORD) {
            showError('Неверный пароль');
            input.select();
            return;
        }
        $('visitorGate').hidden = true;
        $('app').hidden = false;
        setDates();
        await loadData();
        updateAdminUI();
        renderMembers();
        renderAttendance();
    } catch (error) {
        // The visitor gate should still open with the default code if Supabase is temporarily unavailable.
        if (entered === DEFAULT_VISITOR_PASSWORD) {
            $('visitorGate').hidden = true;
            $('app').hidden = false;
            setDates();
            updateAdminUI();
            renderMembers();
            renderAttendance();
            console.warn('Supabase unavailable; opened in offline mode', error);
        } else showError('Ошибка подключения к базе данных: ' + (error.message || error));
    } finally { button.disabled = false; }
}

async function loadData() {
    if (!client) return;
    const [members, attendance] = await Promise.all([
        client.from('members').select('*').order('name'),
        client.from('attendance').select('*')
    ]);
    if (members.error && members.error.code !== '42P01') throw members.error;
    if (attendance.error && attendance.error.code !== '42P01') throw attendance.error;
    appData.members = members.data || [];
    appData.attendance = {};
    (attendance.data || []).forEach(row => { (appData.attendance[row.date] ||= {})[row.member_id] = row.status; });
}

function setDates() {
    const today = new Date().toISOString().slice(0, 10), d = new Date();
    $('dateInput').value = today;
    $('startDate').value = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
    $('endDate').value = today;
}
function adminLogin() { isAdmin = $('adminPassword').value === ADMIN_CODE; $('adminPassword').value = ''; updateAdminUI(); if (!isAdmin) alert('Неверный код администратора'); }
function updateAdminUI() { $('newMemberInput').disabled = !isAdmin; $('addMemberBtn').disabled = !isAdmin; $('adminHint').hidden = isAdmin; $('changeVisitorPassword').hidden = !isAdmin; $('adminStatus').textContent = isAdmin ? 'Доступ открыт' : 'Доступ закрыт'; $('adminStatus').classList.toggle('unlocked', isAdmin); renderMembers(); renderAttendance(); }

function renderMembers() {
    const list = $('membersList'); list.innerHTML = '';
    if (!appData.members.length) { list.innerHTML = '<p class="empty-message">Участники ещё не добавлены.</p>'; return; }
    appData.members.forEach(m => { const item = document.createElement('div'); item.className = 'member-item'; item.innerHTML = `<span class="member-name">${escapeHtml(m.name)}</span><div class="member-actions">${isAdmin ? `<button class="btn btn-edit" onclick="editMember(${m.id})">Изменить</button><button class="btn btn-danger" onclick="deleteMember(${m.id})">Удалить</button>` : '<span class="admin-only-label">Только администратор</span>'}</div>`; list.appendChild(item); });
}
function statsFor(id, start, end) { const s = { present:0, absent:0, valid_absent:0 }; for (let d = new Date(start); d <= new Date(end); d.setDate(d.getDate()+1)) { const v = appData.attendance[d.toISOString().slice(0,10)]?.[id]; if (v) s[v]++; } return s; }
function allStats() { const today = new Date().toISOString().slice(0,10), start = $('startDate').value || today, end = $('endDate').value || today; return Object.fromEntries(appData.members.map(m => [m.id, statsFor(m.id, start, end)])); }
function sortedMembers() { const stats = allStats(), type = $('sortSelect').value; return [...appData.members].sort((a,b) => type === 'name-desc' ? b.name.localeCompare(a.name,'ru') : type === 'absent-most' ? stats[b.id].absent-stats[a.id].absent : type === 'present-most' ? stats[b.id].present-stats[a.id].present : a.name.localeCompare(b.name,'ru')); }
function renderAttendance() { const body = $('attendanceTableBody'); if (!body) return; body.innerHTML = ''; const date = $('dateInput').value; sortedMembers().forEach((m,i) => { const v = appData.attendance[date]?.[m.id] || ''; const row = document.createElement('tr'); row.innerHTML = `<td>${i+1}</td><td>${escapeHtml(m.name)}</td><td class="status-cell"><button class="status-btn ${v==='present'?'active-success':''}" onclick="setAttendance(${m.id},'present')">✓</button></td><td class="status-cell"><button class="status-btn ${v==='absent'?'active-error':''}" onclick="setAttendance(${m.id},'absent')">✗</button></td><td class="status-cell"><button class="status-btn ${v==='valid_absent'?'active-warning':''}" onclick="setAttendance(${m.id},'valid_absent')">⚠</button></td><td class="status-cell">${isAdmin ? `<button class="btn btn-danger" onclick="clearAttendance(${m.id})">Сбросить</button>` : '<span class="admin-only-label">Только администратор</span>'}</td>`; body.appendChild(row); }); }

async function setAttendance(id, status) { if (!client) return; const date = $('dateInput').value, current = appData.attendance[date]?.[id]; const result = current === status ? await client.from('attendance').delete().eq('date',date).eq('member_id',id) : await client.from('attendance').upsert({date,member_id:id,status},{onConflict:'date,member_id'}); if (result.error) return showError(result.error.message); await loadData(); renderAttendance(); }
async function clearAttendance(id) { if (!isAdmin || !client) return; const r = await client.from('attendance').delete().eq('date',$('dateInput').value).eq('member_id',id); if (r.error) return showError(r.error.message); await loadData(); renderAttendance(); }
async function addMember() { if (!isAdmin || !client) return; const input=$('newMemberInput'), name=input.value.trim(); if (!name) return alert('Введите имя'); const r=await client.from('members').insert({name}); if(r.error)return showError(r.error.message); input.value=''; await loadData(); renderMembers(); renderAttendance(); }
async function editMember(id) { if(!isAdmin||!client)return; const m=appData.members.find(x=>x.id===id), name=prompt('Введите новое имя:',m.name); if(!name?.trim())return; const r=await client.from('members').update({name:name.trim()}).eq('id',id); if(r.error)return showError(r.error.message); await loadData(); renderMembers(); renderAttendance(); }
async function deleteMember(id) { if(!isAdmin||!client||!confirm('Удалить участника?'))return; const r=await client.from('members').delete().eq('id',id); if(r.error)return showError(r.error.message); await loadData(); renderMembers(); renderAttendance(); }
async function changeVisitorPassword() { if(!isAdmin||!client)return; const value=$('newVisitorPassword').value.trim(); if(value.length<4)return $('passwordChangeMessage').textContent='Минимум 4 символа'; const r=await client.from('settings').upsert({key:'visitor_password',value},{onConflict:'key'}); $('passwordChangeMessage').textContent=r.error?r.error.message:'Пароль изменён'; }
function generateReport() { const stats=allStats(), body=$('analyticsTableBody'); body.innerHTML=''; appData.members.forEach(m=>{const s=stats[m.id],total=s.present+s.absent+s.valid_absent; const r=document.createElement('tr'); r.innerHTML=`<td>${escapeHtml(m.name)}</td><td>${s.present}</td><td>${s.absent}</td><td>${s.valid_absent}</td><td>${total?Math.round(s.present/total*100):0}%</td>`; body.appendChild(r);}); }
document.addEventListener('DOMContentLoaded', init);