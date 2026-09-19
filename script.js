const SUPABASE_URL = 'https://ycsyatkxzxilrikbirip.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_rhtW_9wSVx4YtW5KPnybnA_6Nu8w2ST';
const ADMIN_CODE = 'Administrator';
const DEFAULT_VISITOR_CODE = 'KDKR1105';

let supabase;
let appData = { members: [], attendance: {} };
let isAdmin = false;
let visitorUnlocked = false;

async function init() {
    window.supabase = window.supabase || (await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'));
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    bindEvents();
    await ensureSettings();
    await loadData();
    setDates();
    document.getElementById('app').hidden = true;
    document.getElementById('visitorGate').hidden = false;
}

function bindEvents() {
    document.getElementById('visitorLoginForm').addEventListener('submit', visitorLogin);
    document.getElementById('adminLoginBtn').addEventListener('click', adminLogin);
    document.getElementById('adminPassword').addEventListener('keydown', e => {
        if (e.key === 'Enter') adminLogin();
    });
    document.getElementById('changeVisitorPasswordBtn').addEventListener('click', changeVisitorPassword);
    document.getElementById('addMemberBtn').addEventListener('click', addMember);
    document.getElementById('newMemberInput').addEventListener('keydown', e => {
        if (e.key === 'Enter') addMember();
    });
    document.getElementById('dateInput').addEventListener('change', renderAttendance);
    document.getElementById('sortSelect').addEventListener('change', renderAttendance);
    document.getElementById('generateReportBtn').addEventListener('click', generateReport);
}

async function ensureSettings() {
    const { data, error } = await supabase.from('settings').select('key, value');
    if (error) {
        if (error.code === '42P01') {
            // table does not exist yet; app will still work when user creates tables manually
            return;
        }
        throw error;
    }

    const map = Object.fromEntries((data || []).map(item => [item.key, item.value]));
    if (!map.visitor_password) {
        const { error: insertError } = await supabase.from('settings').insert([
            { key: 'visitor_password', value: DEFAULT_VISITOR_CODE }
        ]);
        if (insertError) throw insertError;
    }
}

async function loadData() {
    const [{ data: membersData, error: membersError }, { data: attendanceData, error: attendanceError }] = await Promise.all([
        supabase.from('members').select('*').order('name', { ascending: true }),
        supabase.from('attendance').select('*')
    ]);

    if (membersError) {
        if (membersError.code === '42P01') {
            appData.members = [];
            appData.attendance = {};
            return;
        }
        throw membersError;
    }

    if (attendanceError) {
        if (attendanceError.code === '42P01') {
            appData.attendance = {};
        } else {
            throw attendanceError;
        }
    }

    appData.members = membersData || [];
    appData.attendance = {};
    (attendanceData || []).forEach(row => {
        if (!appData.attendance[row.date]) appData.attendance[row.date] = {};
        appData.attendance[row.date][row.member_id] = row.status;
    });

    renderMembers();
    renderAttendance();
}

function setDates() {
    const today = new Date().toISOString().slice(0, 10);
    const d = new Date();
    document.getElementById('dateInput').value = today;
    document.getElementById('startDate').value = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
    document.getElementById('endDate').value = today;
}

async function visitorLogin(event) {
    event.preventDefault();
    const input = document.getElementById('visitorPassword');
    const { data, error } = await supabase.from('settings').select('value').eq('key', 'visitor_password').single();

    if (error && error.code !== 'PGRST116') {
        throw error;
    }

    const correctCode = data?.value || DEFAULT_VISITOR_CODE;
    if (input.value === correctCode) {
        visitorUnlocked = true;
        document.getElementById('visitorGate').hidden = true;
        document.getElementById('app').hidden = false;
        await loadData();
        setDates();
        updateAdminUI();
        renderMembers();
        renderAttendance();
        return;
    }

    document.getElementById('visitorLoginError').hidden = false;
    input.select();
}

function adminLogin() {
    const input = document.getElementById('adminPassword');
    if (input.value === ADMIN_CODE) {
        isAdmin = true;
        input.value = '';
        updateAdminUI();
    } else {
        isAdmin = false;
        input.value = '';
        updateAdminUI();
        alert('Неверный код администратора');
    }
}

function updateAdminUI() {
    const input = document.getElementById('newMemberInput');
    const button = document.getElementById('addMemberBtn');
    input.disabled = !isAdmin;
    button.disabled = !isAdmin;

    const status = document.getElementById('adminStatus');
    status.textContent = isAdmin ? 'Доступ открыт' : 'Доступ закрыт';
    status.classList.toggle('unlocked', isAdmin);
    document.getElementById('adminHint').hidden = isAdmin;
    document.getElementById('changeVisitorPassword').hidden = !isAdmin;
    renderMembers();
    renderAttendance();
}

async function changeVisitorPassword() {
    if (!isAdmin) return;

    const field = document.getElementById('newVisitorPassword');
    const value = field.value.trim();
    const message = document.getElementById('passwordChangeMessage');

    if (value.length < 4) {
        message.textContent = 'Пароль должен содержать минимум 4 символа';
        return;
    }

    const { error } = await supabase.from('settings').upsert(
        { key: 'visitor_password', value },
        { onConflict: 'key' }
    );

    if (error) throw error;

    field.value = '';
    message.textContent = 'Пароль посетителя изменён';
    setTimeout(() => message.textContent = '', 3000);
}

function renderMembers() {
    const list = document.getElementById('membersList');
    list.innerHTML = '';

    if (!appData.members.length) {
        list.innerHTML = '<p class="empty-message">Участники ещё не добавлены.</p>';
        return;
    }

    appData.members.forEach(member => {
        const item = document.createElement('div');
        item.className = 'member-item';
        item.innerHTML = `
            <span class="member-name">${escapeHtml(member.name)}</span>
            <div class="member-actions">
                ${isAdmin ? `
                    <button class="btn btn-edit" onclick="editMember(${member.id})">Изменить</button>
                    <button class="btn btn-danger" onclick="deleteMember(${member.id})">Удалить</button>
                ` : '<span class="admin-only-label">Только администратор</span>'}
            </div>
        `;
        list.appendChild(item);
    });
}

function renderAttendance() {
    const body = document.getElementById('attendanceTableBody');
    if (!body) return;

    body.innerHTML = '';
    const date = document.getElementById('dateInput').value;
    const sortedMembers = sortMembers([...appData.members], document.getElementById('sortSelect').value);

    sortedMembers.forEach((member, index) => {
        const value = appData.attendance[date]?.[member.id] || '';
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${index + 1}</td>
            <td>${escapeHtml(member.name)}</td>
            <td class="status-cell"><button class="status-btn ${value === 'present' ? 'active-success' : ''}" onclick="setAttendance(${member.id}, 'present')">✓</button></td>
            <td class="status-cell"><button class="status-btn ${value === 'absent' ? 'active-error' : ''}" onclick="setAttendance(${member.id}, 'absent')">✗</button></td>
            <td class="status-cell"><button class="status-btn ${value === 'valid_absent' ? 'active-warning' : ''}" onclick="setAttendance(${member.id}, 'valid_absent')">⚠</button></td>
            <td class="status-cell">
                ${isAdmin ? `<button class="btn btn-danger" onclick="clearAttendance(${member.id})">Сбросить</button>` : '<span class="admin-only-label">Только администратор</span>'}
            </td>
        `;
        body.appendChild(row);
    });
}

function sortMembers(members, type) {
    const stats = allStats();
    if (type === 'name') return members.sort((a, b) => a.name.localeCompare(b.name, 'ru'));
    if (type === 'name-desc') return members.sort((a, b) => b.name.localeCompare(a.name, 'ru'));
    if (type === 'absent-most') return members.sort((a, b) => (stats[b.id]?.absent || 0) - (stats[a.id]?.absent || 0));
    if (type === 'present-most') return members.sort((a, b) => (stats[b.id]?.present || 0) - (stats[a.id]?.present || 0));
    return members;
}

async function setAttendance(memberId, value) {
    const date = document.getElementById('dateInput').value;
    const current = appData.attendance[date]?.[memberId];

    const nextValue = current === value ? null : value;
    if (nextValue === null) {
        const { error } = await supabase.from('attendance').delete().eq('date', date).eq('member_id', memberId);
        if (error) throw error;
    } else {
        const { error } = await supabase.from('attendance').upsert(
            { date, member_id: memberId, status: nextValue },
            { onConflict: 'date,member_id' }
        );
        if (error) throw error;
    }

    await loadData();
    renderAttendance();
}

async function clearAttendance(memberId) {
    if (!isAdmin) return;
    const date = document.getElementById('dateInput').value;
    const { error } = await supabase.from('attendance').delete().eq('date', date).eq('member_id', memberId);
    if (error) throw error;
    await loadData();
    renderAttendance();
}

async function addMember() {
    if (!isAdmin) return;

    const input = document.getElementById('newMemberInput');
    const name = input.value.trim();

    if (!name) {
        alert('Пожалуйста, введите имя');
        return;
    }

    if (appData.members.some(member => member.name.toLowerCase() === name.toLowerCase())) {
        alert('Такой участник уже есть');
        return;
    }

    const { error } = await supabase.from('members').insert([{ name }]);
    if (error) throw error;

    input.value = '';
    await loadData();
    renderMembers();
    renderAttendance();
}

async function editMember(memberId) {
    if (!isAdmin) return;

    const member = appData.members.find(item => item.id === memberId);
    const newName = prompt('Введите новое имя:', member.name);
    if (!newName || !newName.trim()) return;

    const { error } = await supabase.from('members').update({ name: newName.trim() }).eq('id', memberId);
    if (error) throw error;

    await loadData();
    renderMembers();
    renderAttendance();
}

async function deleteMember(memberId) {
    if (!isAdmin || !confirm('Удалить участника? Это действие нельзя отменить.')) return;

    const { error: memberError } = await supabase.from('members').delete().eq('id', memberId);
    if (memberError) throw memberError;

    const { error: attendanceError } = await supabase.from('attendance').delete().eq('member_id', memberId);
    if (attendanceError) throw attendanceError;

    await loadData();
    renderMembers();
    renderAttendance();
}

function statsFor(memberId, start, end) {
    const result = { present: 0, absent: 0, valid_absent: 0 };
    for (let d = new Date(start); d <= new Date(end); d.setDate(d.getDate() + 1)) {
        const key = d.toISOString().slice(0, 10);
        const value = appData.attendance[key]?.[memberId];
        if (value) result[value]++;
    }
    return result;
}

function allStats() {
    const today = new Date().toISOString().slice(0, 10);
    const start = document.getElementById('startDate')?.value || today;
    const end = document.getElementById('endDate')?.value || today;

    return Object.fromEntries(appData.members.map(member => [member.id, statsFor(member.id, start, end)]));
}

function generateReport() {
    const start = document.getElementById('startDate').value;
    const end = document.getElementById('endDate').value;
    if (!start || !end) {
        alert('Пожалуйста, выберите период');
        return;
    }

    const stats = allStats();
    const tableBody = document.getElementById('analyticsTableBody');
    tableBody.innerHTML = '';

    [...appData.members].sort((a, b) => a.name.localeCompare(b.name, 'ru')).forEach(member => {
        const memberStats = stats[member.id];
        const total = memberStats.present + memberStats.absent + memberStats.valid_absent;
        const percentage = total ? Math.round((memberStats.present / total) * 100) : 0;

        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${escapeHtml(member.name)}</td>
            <td>${memberStats.present}</td>
            <td>${memberStats.absent}</td>
            <td>${memberStats.valid_absent}</td>
            <td>${percentage}%</td>
        `;
        tableBody.appendChild(row);
    });

    renderTop('topAbsentList', stats, 'absent', 'Отсутствий:', 'Нет данных об отсутствиях', 'error');
    renderTop('topAbsentValidList', stats, 'valid_absent', 'Уважительных причин:', 'Нет данных об уважительных причинах', 'warning');
}

function renderTop(elementId, stats, key, label, emptyText, className) {
    const list = document.getElementById(elementId);
    const items = appData.members
        .map(member => ({ member, count: stats[member.id]?.[key] || 0 }))
        .filter(item => item.count > 0)
        .sort((a, b) => b.count - a.count)
        .slice(0, 3);

    list.innerHTML = items.length
        ? items.map((item, index) => `
            <div class="top-item ${className}">
                <div class="top-rank ${className}">${index + 1}.</div>
                <div class="top-info">
                    <div class="top-name">${escapeHtml(item.member.name)}</div>
                    <div class="top-count">${label} ${item.count}</div>
                </div>
            </div>
        `).join('')
        : `<p class="empty-message">${emptyText}</p>`;
}

function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, char => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    }[char]));
}

document.addEventListener('DOMContentLoaded', init);
