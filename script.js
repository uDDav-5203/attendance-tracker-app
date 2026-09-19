const ADMIN_CODE = 'Administrator';
const OLD_DEFAULT_NAMES = ['Алексей','Мария','Иван','Екатерина','Сергей','Анна','Павел','Виктория','Дмитрий','Елена','Николай','Ольга','Владимир'];
let appData = { members: [], attendance: {} };
let isAdmin = false;

function init() {
    loadData();
    setDates();
    bindEvents();
    updateAdminUI();
    renderAttendance();
    renderMembers();
}

function loadData() {
    try { appData = JSON.parse(localStorage.getItem('attendanceData')) || { members: [], attendance: {} }; }
    catch { appData = { members: [], attendance: {} }; }
    appData.members = appData.members || [];
    appData.attendance = appData.attendance || {};
    // Удаляем только старый автоматически созданный список из 13 имён.
    if (appData.members.length === OLD_DEFAULT_NAMES.length && appData.members.every(m => OLD_DEFAULT_NAMES.includes(m.name))) {
        appData.members = [];
        saveData();
    }
}
function saveData() { localStorage.setItem('attendanceData', JSON.stringify(appData)); }
function setDates() {
    const today = new Date().toISOString().slice(0, 10);
    const date = new Date();
    document.getElementById('dateInput').value = today;
    document.getElementById('startDate').value = new Date(date.getFullYear(), date.getMonth(), 1).toISOString().slice(0, 10);
    document.getElementById('endDate').value = today;
}
function bindEvents() {
    document.getElementById('adminLoginBtn').addEventListener('click', loginAdmin);
    document.getElementById('adminPassword').addEventListener('keydown', e => { if (e.key === 'Enter') loginAdmin(); });
    document.getElementById('addMemberBtn').addEventListener('click', addMember);
    document.getElementById('newMemberInput').addEventListener('keydown', e => { if (e.key === 'Enter') addMember(); });
    document.getElementById('dateInput').addEventListener('change', renderAttendance);
    document.getElementById('sortSelect').addEventListener('change', renderAttendance);
    document.getElementById('generateReportBtn').addEventListener('click', generateReport);
}
function loginAdmin() {
    const field = document.getElementById('adminPassword');
    if (field.value === ADMIN_CODE) { isAdmin = true; field.value = ''; updateAdminUI(); }
    else { isAdmin = false; field.value = ''; updateAdminUI(); alert('Неверный код доступа'); }
}
function updateAdminUI() {
    const input = document.getElementById('newMemberInput'), button = document.getElementById('addMemberBtn');
    input.disabled = !isAdmin; button.disabled = !isAdmin;
    const status = document.getElementById('adminStatus');
    status.textContent = isAdmin ? 'Доступ открыт' : 'Доступ закрыт';
    status.classList.toggle('unlocked', isAdmin);
    document.getElementById('adminHint').hidden = isAdmin;
    renderMembers(); renderAttendance();
}
function renderMembers() {
    const list = document.getElementById('membersList'); list.innerHTML = '';
    if (!appData.members.length) { list.innerHTML = '<p class="empty-message">Участники ещё не добавлены.</p>'; return; }
    appData.members.forEach(member => {
        const item = document.createElement('div'); item.className = 'member-item';
        item.innerHTML = `<span class="member-name">${escapeHtml(member.name)}</span><div class="member-actions">${isAdmin ? `<button class="btn btn-edit" onclick="editMember(${member.id})">Изменить</button><button class="btn btn-danger" onclick="deleteMember(${member.id})">Удалить</button>` : '<span class="admin-only-label">Только администратор</span>'}</div>`;
        list.appendChild(item);
    });
}
function renderAttendance() {
    const body = document.getElementById('attendanceTableBody'); body.innerHTML = '';
    const date = document.getElementById('dateInput').value;
    sortMembers([...appData.members], document.getElementById('sortSelect').value).forEach((member, i) => {
        const value = appData.attendance[date]?.[member.id] || '';
        const row = document.createElement('tr');
        row.innerHTML = `<td>${i + 1}</td><td>${escapeHtml(member.name)}</td><td class="status-cell"><button class="status-btn ${value === 'present' ? 'active-success' : ''}" onclick="setAttendance(${member.id},'present')">✓</button></td><td class="status-cell"><button class="status-btn ${value === 'absent' ? 'active-error' : ''}" onclick="setAttendance(${member.id},'absent')">✗</button></td><td class="status-cell"><button class="status-btn ${value === 'valid_absent' ? 'active-warning' : ''}" onclick="setAttendance(${member.id},'valid_absent')">⚠</button></td><td class="status-cell">${isAdmin ? `<button class="btn btn-danger" onclick="clearAttendance(${member.id})">Сбросить</button>` : '<span class="admin-only-label">Только администратор</span>'}</td>`;
        body.appendChild(row);
    });
}
function sortMembers(members, type) {
    const stats = allStats();
    if (type === 'name') return members.sort((a,b) => a.name.localeCompare(b.name, 'ru'));
    if (type === 'name-desc') return members.sort((a,b) => b.name.localeCompare(a.name, 'ru'));
    if (type === 'absent-most') return members.sort((a,b) => stats[b.id].absent - stats[a.id].absent);
    if (type === 'present-most') return members.sort((a,b) => stats[b.id].present - stats[a.id].present);
    return members;
}
function setAttendance(id, value) {
    const date = document.getElementById('dateInput').value;
    appData.attendance[date] = appData.attendance[date] || {};
    appData.attendance[date][id] = appData.attendance[date][id] === value ? null : value;
    saveData(); renderAttendance();
}
function clearAttendance(id) {
    if (!isAdmin) return;
    const date = document.getElementById('dateInput').value;
    if (appData.attendance[date]) appData.attendance[date][id] = null;
    saveData(); renderAttendance();
}
function addMember() {
    if (!isAdmin) return;
    const input = document.getElementById('newMemberInput'), name = input.value.trim();
    if (!name) return alert('Пожалуйста, введите имя');
    if (appData.members.some(m => m.name.toLowerCase() === name.toLowerCase())) return alert('Такой участник уже есть');
    appData.members.push({ id: Math.max(-1, ...appData.members.map(m => m.id)) + 1, name });
    input.value = ''; saveData(); renderMembers(); renderAttendance();
}
function editMember(id) {
    if (!isAdmin) return;
    const member = appData.members.find(m => m.id === id), name = prompt('Введите новое имя:', member.name);
    if (name && name.trim()) { member.name = name.trim(); saveData(); renderMembers(); renderAttendance(); }
}
function deleteMember(id) {
    if (!isAdmin || !confirm('Удалить участника? Это действие нельзя отменить.')) return;
    appData.members = appData.members.filter(m => m.id !== id);
    Object.values(appData.attendance).forEach(day => delete day[id]);
    saveData(); renderMembers(); renderAttendance();
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
    [...appData.members].sort((a,b) => a.name.localeCompare(b.name, 'ru')).forEach(m => {
        const s = stats[m.id], total = s.present + s.absent + s.valid_absent, percent = total ? Math.round(s.present / total * 100) : 0;
        const row = document.createElement('tr'); row.innerHTML = `<td>${escapeHtml(m.name)}</td><td>${s.present}</td><td>${s.absent}</td><td>${s.valid_absent}</td><td>${percent}%</td>`; body.appendChild(row);
    });
    renderTop('topAbsentList', stats, 'absent', 'Отсутствий:', 'Нет данных об отсутствиях', 'error');
    renderTop('topAbsentValidList', stats, 'valid_absent', 'Уважительных причин:', 'Нет данных об уважительных причинах', 'warning');
}
function renderTop(id, stats, key, label, empty, type) {
    const list = document.getElementById(id), items = appData.members.map(m => ({ member:m, count:stats[m.id][key] })).filter(x => x.count > 0).sort((a,b) => b.count - a.count).slice(0,3);
    list.innerHTML = items.length ? items.map((x,i) => `<div class="top-item ${type}"><b class="top-rank ${type}">${i+1}.</b><div><b>${escapeHtml(x.member.name)}</b><div class="top-count">${label} ${x.count}</div></div></div>`).join('') : `<p class="empty-message">${empty}</p>`;
}
function escapeHtml(value) { return String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c])); }
document.addEventListener('DOMContentLoaded', init);