const SUPABASE_URL = 'https://ycsyatkxzxilrikbirip.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_rhtW_9wSVx4YtW5KPnybnA_6Nu8w2ST';
const ADMIN_CODE = 'Administrator';
const DEFAULT_VISITOR_CODE = 'KDKR1105';

let supabaseClient;
let appData = { members: [], attendance: {} };
let isAdmin = false;

function db() {
    if (!window.supabase || typeof window.supabase.createClient !== 'function') {
        throw new Error('Библиотека Supabase не загрузилась. Проверьте интернет-соединение.');
    }
    return window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

async function init() {
    try {
        supabaseClient = db();
        bindEvents();
        setDates();
        document.getElementById('app').hidden = true;
        document.getElementById('visitorGate').hidden = false;
    } catch (error) {
        showError(error);
    }
}

function bindEvents() {
    document.getElementById('visitorLoginForm').addEventListener('submit', visitorLogin);
    document.getElementById('adminLoginBtn').addEventListener('click', adminLogin);
    document.getElementById('adminPassword').addEventListener('keydown', e => { if (e.key === 'Enter') adminLogin(); });
    document.getElementById('changeVisitorPasswordBtn').addEventListener('click', changeVisitorPassword);
    document.getElementById('addMemberBtn').addEventListener('click', addMember);
    document.getElementById('newMemberInput').addEventListener('keydown', e => { if (e.key === 'Enter') addMember(); });
    document.getElementById('dateInput').addEventListener('change', renderAttendance);
    document.getElementById('sortSelect').addEventListener('change', renderAttendance);
    document.getElementById('generateReportBtn').addEventListener('click', generateReport);
}

async function visitorLogin(event) {
    event.preventDefault();
    const input = document.getElementById('visitorPassword');
    const errorText = document.getElementById('visitorLoginError');
    const button = event.submitter || event.target.querySelector('button[type="submit"]');
    button.disabled = true;
    errorText.hidden = true;

    try {
        const result = await supabaseClient
            .from('settings')
            .select('value')
            .eq('key', 'visitor_password')
            .maybeSingle();

        // Если settings ещё не создана или запись отсутствует, используем начальный пароль.
        // Это предотвращает белый экран после перезагрузки.
        if (result.error && result.error.code !== '42P01') throw result.error;
        const correctPassword = String(result.data?.value || DEFAULT_VISITOR_CODE).trim();

        if (input.value.trim() !== correctPassword) {
            errorText.textContent = 'Неверный пароль';
            errorText.hidden = false;
            input.select();
            return;
        }

        document.getElementById('visitorGate').hidden = true;
        document.getElementById('app').hidden = false;
        await loadData();
        updateAdminUI();
        renderMembers();
        renderAttendance();
    } catch (error) {
        showError(error, 'Не удалось проверить пароль. Проверьте, что таблицы Supabase созданы и доступен интернет.');
    } finally {
        button.disabled = false;
    }
}

function setDates() {
    const today = new Date().toISOString().slice(0, 10);
    const date = new Date();
    document.getElementById('dateInput').value = today;
    document.getElementById('startDate').value = new Date(date.getFullYear(), date.getMonth(), 1).toISOString().slice(0, 10);
    document.getElementById('endDate').value = today;
}

async function loadData() {
    const [membersResult, attendanceResult] = await Promise.all([
        supabaseClient.from('members').select('*').order('name', { ascending: true }),
        supabaseClient.from('attendance').select('*')
    ]);
    if (membersResult.error && membersResult.error.code !== '42P01') throw membersResult.error;
    if (attendanceResult.error && attendanceResult.error.code !== '42P01') throw attendanceResult.error;

    appData.members = membersResult.data || [];
    appData.attendance = {};
    (attendanceResult.data || []).forEach(row => {
        if (!appData.attendance[row.date]) appData.attendance[row.date] = {};
        appData.attendance[row.date][row.member_id] = row.status;
    });
}

function adminLogin() {
    const input = document.getElementById('adminPassword');
    isAdmin = input.value === ADMIN_CODE;
    input.value = '';
    updateAdminUI();
    if (!isAdmin) alert('Неверный код администратора');
}

function updateAdminUI() {
    document.getElementById('newMemberInput').disabled = !isAdmin;
    document.getElementById('addMemberBtn').disabled = !isAdmin;
    document.getElementById('adminHint').hidden = isAdmin;
    document.getElementById('changeVisitorPassword').hidden = !isAdmin;
    const status = document.getElementById('adminStatus');
    status.textContent = isAdmin ? 'Доступ открыт' : 'Доступ закрыт';
    status.classList.toggle('unlocked', isAdmin);
    renderMembers();
    renderAttendance();
}

async function changeVisitorPassword() {
    if (!isAdmin) return;
    const field = document.getElementById('newVisitorPassword');
    const value = field.value.trim();
    const message = document.getElementById('passwordChangeMessage');
    if (value.length < 4) { message.textContent = 'Пароль должен содержать минимум 4 символа'; return; }
    const { error } = await supabaseClient.from('settings').upsert({ key: 'visitor_password', value }, { onConflict: 'key' });
    if (error) return showError(error);
    field.value = '';
    message.textContent = 'Пароль посетителя изменён';
}

function renderMembers() {
    const list = document.getElementById('membersList');
    list.innerHTML = '';
    if (!appData.members.length) { list.innerHTML = '<p class="empty-message">Участники ещё не добавлены.</p>'; return; }
    appData.members.forEach(member => {
        const item = document.createElement('div'); item.className = 'member-item';
        item.innerHTML = `<span class="member-name">${escapeHtml(member.name)}</span><div class="member-actions">${isAdmin ? `<button class="btn btn-edit" onclick="editMember(${member.id})">Изменить</button><button class="btn btn-danger" onclick="deleteMember(${member.id})">Удалить</button>` : '<span class="admin-only-label">Только администратор</span>'}</div>`;
        list.appendChild(item);
    });
}

function renderAttendance() {
    const body = document.getElementById('attendanceTableBody');
    if (!body) return;
    body.innerHTML = '';
    const date = document.getElementById('dateInput').value;
    sortMembers([...appData.members], document.getElementById('sortSelect').value).forEach((member, index) => {
        const value = appData.attendance[date]?.[member.id] || '';
        const row = document.createElement('tr');
        row.innerHTML = `<td>${index + 1}</td><td>${escapeHtml(member.name)}</td><td class="status-cell"><button class="status-btn ${value === 'present' ? 'active-success' : ''}" onclick="setAttendance(${member.id},'present')">✓</button></td><td class="status-cell"><button class="status-btn ${value === 'absent' ? 'active-error' : ''}" onclick="setAttendance(${member.id},'absent')">✗</button></td><td class="status-cell"><button class="status-btn ${value === 'valid_absent' ? 'active-warning' : ''}" onclick="setAttendance(${member.id},'valid_absent')">⚠</button></td><td class="status-cell">${isAdmin ? `<button class="btn btn-danger" onclick="clearAttendance(${member.id})">Сбросить</button>` : '<span class="admin-only-label">Только администратор</span>'}</td>`;
        body.appendChild(row);
    });
}

function sortMembers(members, type) {
    const stats = allStats();
    if (type === 'name') return members.sort((a,b) => a.name.localeCompare(b.name, 'ru'));
    if (type === 'name-desc') return members.sort((a,b) => b.name.localeCompare(a.name, 'ru'));
    if (type === 'absent-most') return members.sort((a,b) => (stats[b.id]?.absent || 0) - (stats[a.id]?.absent || 0));
    if (type === 'present-most') return members.sort((a,b) => (stats[b.id]?.present || 0) - (stats[a.id]?.present || 0));
    return members;
}

async function setAttendance(memberId, value) {
    try {
        const date = document.getElementById('dateInput').value;
        const current = appData.attendance[date]?.[memberId];
        let result;
        if (current === value) result = await supabaseClient.from('attendance').delete().eq('date', date).eq('member_id', memberId);
        else result = await supabaseClient.from('attendance').upsert({ date, member_id: memberId, status: value }, { onConflict: 'date,member_id' });
        if (result.error) throw result.error;
        await loadData(); renderAttendance();
    } catch (error) { showError(error); }
}

async function clearAttendance(memberId) {
    if (!isAdmin) return;
    try {
        const result = await supabaseClient.from('attendance').delete().eq('date', document.getElementById('dateInput').value).eq('member_id', memberId);
        if (result.error) throw result.error;
        await loadData(); renderAttendance();
    } catch (error) { showError(error); }
}

async function addMember() {
    if (!isAdmin) return;
    const input = document.getElementById('newMemberInput'), name = input.value.trim();
    if (!name) return alert('Пожалуйста, введите имя');
    if (appData.members.some(m => m.name.toLowerCase() === name.toLowerCase())) return alert('Такой участник уже есть');
    try {
        const result = await supabaseClient.from('members').insert([{ name }]);
        if (result.error) throw result.error;
        input.value = ''; await loadData(); renderMembers(); renderAttendance();
    } catch (error) { showError(error); }
}

async function editMember(memberId) {
    if (!isAdmin) return;
    const member = appData.members.find(m => m.id === memberId), name = prompt('Введите новое имя:', member.name);
    if (!name || !name.trim()) return;
    try {
        const result = await supabaseClient.from('members').update({ name: name.trim() }).eq('id', memberId);
        if (result.error) throw result.error;
        await loadData(); renderMembers(); renderAttendance();
    } catch (error) { showError(error); }
}

async function deleteMember(memberId) {
    if (!isAdmin || !confirm('Удалить участника? Это действие нельзя отменить.')) return;
    try {
        const result = await supabaseClient.from('members').delete().eq('id', memberId);
        if (result.error) throw result.error;
        await loadData(); renderMembers(); renderAttendance();
    } catch (error) { showError(error); }
}

function statsFor(id, start, end) {
    const result = { present: 0, absent: 0, valid_absent: 0 };
    for (let d = new Date(start); d <= new Date(end); d.setDate(d.getDate() + 1)) {
        const value = appData.attendance[d.toISOString().slice(0,10)]?.[id];
        if (value) result[value]++;
    }
    return result;
}
function allStats() {
    const today = new Date().toISOString().slice(0,10), start = document.getElementById('startDate')?.value || today, end = document.getElementById('endDate')?.value || today;
    return Object.fromEntries(appData.members.map(m => [m.id, statsFor(m.id, start, end)]));
}
function generateReport() {
    const start = document.getElementById('startDate').value, end = document.getElementById('endDate').value;
    if (!start || !end) return alert('Пожалуйста, выберите период');
    const stats = allStats(), body = document.getElementById('analyticsTableBody'); body.innerHTML = '';
    [...appData.members].sort((a,b) => a.name.localeCompare(b.name, 'ru')).forEach(m => { const s = stats[m.id], total = s.present+s.absent+s.valid_absent, p = total ? Math.round(s.present/total*100) : 0; const row = document.createElement('tr'); row.innerHTML = `<td>${escapeHtml(m.name)}</td><td>${s.present}</td><td>${s.absent}</td><td>${s.valid_absent}</td><td>${p}%</td>`; body.appendChild(row); });
    renderTop('topAbsentList', stats, 'absent', 'Отсутствий:', 'Нет данных об отсутствиях', 'error');
    renderTop('topAbsentValidList', stats, 'valid_absent', 'Уважительных причин:', 'Нет данных об уважительных причинах', 'warning');
}
function renderTop(id, stats, key, label, empty, type) { const list = document.getElementById(id), items = appData.members.map(m => ({m, count: stats[m.id]?.[key] || 0})).filter(x => x.count > 0).sort((a,b) => b.count-a.count).slice(0,3); list.innerHTML = items.length ? items.map((x,i) => `<div class="top-item ${type}"><b class="top-rank ${type}">${i+1}.</b><div><b>${escapeHtml(x.m.name)}</b><div class="top-count">${label} ${x.count}</div></div></div>`).join('') : `<p class="empty-message">${empty}</p>`; }
function escapeHtml(value) { return String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[char])); }
function showError(error, prefix = 'Произошла ошибка') { console.error(error); const text = `${prefix}: ${error?.message || error}`; const el = document.getElementById('visitorLoginError'); if (el) { el.textContent = text; el.hidden = false; } else alert(text); }
document.addEventListener('DOMContentLoaded', init);
