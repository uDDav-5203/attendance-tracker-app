// Default members
const DEFAULT_MEMBERS = [
    'Алексей', 'Мария', 'Иван', 'Екатерина', 'Сергей',
    'Анна', 'Павел', 'Виктория', 'Дмитрий', 'Елена',
    'Николай', 'Ольга', 'Владимир'
];

// Data structure
let appData = {
    members: [],
    attendance: {} // { date: { memberId: 'present'|'absent'|'valid_absent' } }
};

// Initialize app
function init() {
    loadFromLocalStorage();
    setDefaultDate();
    renderMembers();
    renderAttendanceTable();
    attachEventListeners();
}

// LocalStorage functions
function loadFromLocalStorage() {
    const saved = localStorage.getItem('attendanceData');
    if (saved) {
        appData = JSON.parse(saved);
    } else {
        appData.members = DEFAULT_MEMBERS.map((name, index) => ({
            id: index,
            name: name
        }));
        saveToLocalStorage();
    }
}

function saveToLocalStorage() {
    localStorage.setItem('attendanceData', JSON.stringify(appData));
}

// Date functions
function setDefaultDate() {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('dateInput').value = today;
    
    // Set date range to this month
    const date = new Date();
    const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
    document.getElementById('startDate').value = firstDay.toISOString().split('T')[0];
    document.getElementById('endDate').value = today;
}

// Render members in management section
function renderMembers() {
    const membersList = document.getElementById('membersList');
    membersList.innerHTML = '';
    
    appData.members.forEach(member => {
        const memberItem = document.createElement('div');
        memberItem.className = 'member-item';
        memberItem.innerHTML = `
            <span class="member-name">${escapeHtml(member.name)}</span>
            <div class="member-actions">
                <button class="btn btn-edit" onclick="startEditMember(${member.id})">Изменить</button>
                <button class="btn btn-danger" onclick="deleteMember(${member.id})">Удалить</button>
            </div>
        `;
        membersList.appendChild(memberItem);
    });
}

// Render attendance table
function renderAttendanceTable() {
    const tableBody = document.getElementById('attendanceTableBody');
    tableBody.innerHTML = '';
    
    const currentDate = document.getElementById('dateInput').value;
    const sortType = document.getElementById('sortSelect').value;
    
    let sortedMembers = [...appData.members];
    sortedMembers = sortMembersBy(sortedMembers, sortType);
    
    sortedMembers.forEach((member, index) => {
        const attendance = appData.attendance[currentDate]?.[member.id] || null;
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${index + 1}</td>
            <td>${escapeHtml(member.name)}</td>
            <td class="status-cell">
                <button class="status-btn ${attendance === 'present' ? 'active-success' : ''}" 
                        onclick="setAttendance(${member.id}, 'present')" title="Присутствует">
                    ✓
                </button>
            </td>
            <td class="status-cell">
                <button class="status-btn ${attendance === 'absent' ? 'active-error' : ''}" 
                        onclick="setAttendance(${member.id}, 'absent')" title="Отсутствует">
                    ✗
                </button>
            </td>
            <td class="status-cell">
                <button class="status-btn ${attendance === 'valid_absent' ? 'active-warning' : ''}" 
                        onclick="setAttendance(${member.id}, 'valid_absent')" title="Уважительная причина">
                    ⚠
                </button>
            </td>
            <td class="status-cell">
                <button class="btn btn-danger" onclick="clearAttendance(${member.id})" style="font-size: 12px;">Сбросить</button>
            </td>
        `;
        tableBody.appendChild(row);
    });
}

// Sort members
function sortMembersBy(members, sortType) {
    const stats = calculateAllStats();
    
    switch(sortType) {
        case 'name':
            return members.sort((a, b) => a.name.localeCompare(b.name, 'ru'));
        case 'name-desc':
            return members.sort((a, b) => b.name.localeCompare(a.name, 'ru'));
        case 'absent-most':
            return members.sort((a, b) => {
                const statA = stats[a.id] || { absent: 0 };
                const statB = stats[b.id] || { absent: 0 };
                return statB.absent - statA.absent;
            });
        case 'present-most':
            return members.sort((a, b) => {
                const statA = stats[a.id] || { present: 0 };
                const statB = stats[b.id] || { present: 0 };
                return statB.present - statA.present;
            });
        default:
            return members;
    }
}

// Set attendance
function setAttendance(memberId, status) {
    const currentDate = document.getElementById('dateInput').value;
    if (!appData.attendance[currentDate]) {
        appData.attendance[currentDate] = {};
    }
    
    // Toggle if same status is clicked
    if (appData.attendance[currentDate][memberId] === status) {
        appData.attendance[currentDate][memberId] = null;
    } else {
        appData.attendance[currentDate][memberId] = status;
    }
    
    saveToLocalStorage();
    renderAttendanceTable();
}

// Clear attendance
function clearAttendance(memberId) {
    const currentDate = document.getElementById('dateInput').value;
    if (appData.attendance[currentDate]) {
        appData.attendance[currentDate][memberId] = null;
    }
    saveToLocalStorage();
    renderAttendanceTable();
}

// Add member
function addMember() {
    const input = document.getElementById('newMemberInput');
    const name = input.value.trim();
    
    if (!name) {
        alert('Пожалуйста, введите имя');
        return;
    }
    
    if (appData.members.length >= 50) {
        alert('Максимум 50 участников');
        return;
    }
    
    const newId = Math.max(...appData.members.map(m => m.id), -1) + 1;
    appData.members.push({ id: newId, name: name });
    
    input.value = '';
    saveToLocalStorage();
    renderMembers();
    renderAttendanceTable();
}

// Edit member
function startEditMember(memberId) {
    const member = appData.members.find(m => m.id === memberId);
    const newName = prompt('Введите новое имя:', member.name);
    
    if (newName && newName.trim()) {
        member.name = newName.trim();
        saveToLocalStorage();
        renderMembers();
        renderAttendanceTable();
    }
}

// Delete member
function deleteMember(memberId) {
    if (confirm('Удалить участника? Это действие нельзя отменить.')) {
        appData.members = appData.members.filter(m => m.id !== memberId);
        
        // Clean attendance data
        Object.keys(appData.attendance).forEach(date => {
            delete appData.attendance[date][memberId];
        });
        
        saveToLocalStorage();
        renderMembers();
        renderAttendanceTable();
    }
}

// Calculate statistics
function calculateStats(memberId, startDate, endDate) {
    const stats = {
        present: 0,
        absent: 0,
        valid_absent: 0
    };
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0];
        const attendance = appData.attendance[dateStr]?.[memberId];
        
        if (attendance === 'present') stats.present++;
        else if (attendance === 'absent') stats.absent++;
        else if (attendance === 'valid_absent') stats.valid_absent++;
    }
    
    return stats;
}

function calculateAllStats() {
    const today = new Date().toISOString().split('T')[0];
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value || today;
    
    const allStats = {};
    appData.members.forEach(member => {
        allStats[member.id] = calculateStats(member.id, startDate, endDate);
    });
    
    return allStats;
}

// Generate analytics report
function generateReport() {
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;
    
    if (!startDate || !endDate) {
        alert('Пожалуйста, выберите период');
        return;
    }
    
    const stats = calculateAllStats();
    
    // Update analytics table
    const analyticsBody = document.getElementById('analyticsTableBody');
    analyticsBody.innerHTML = '';
    
    const sortedMembers = [...appData.members].sort((a, b) => 
        a.name.localeCompare(b.name, 'ru')
    );
    
    sortedMembers.forEach(member => {
        const memberStats = stats[member.id];
        const total = memberStats.present + memberStats.absent + memberStats.valid_absent;
        const attendance = total > 0 ? Math.round((memberStats.present / total) * 100) : 0;
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${escapeHtml(member.name)}</td>
            <td><span style="color: var(--success-green); font-weight: 600;">${memberStats.present}</span></td>
            <td><span style="color: var(--error-red); font-weight: 600;">${memberStats.absent}</span></td>
            <td><span style="color: var(--warning-orange); font-weight: 600;">${memberStats.valid_absent}</span></td>
            <td>
                <div style="display: flex; align-items: center; gap: 8px;">
                    <div style="width: 100px; height: 6px; background-color: var(--bg-tertiary); border-radius: 3px; overflow: hidden;">
                        <div style="height: 100%; width: ${attendance}%; background-color: var(--success-green);"></div>
                    </div>
                    <span>${attendance}%</span>
                </div>
            </td>
        `;
        analyticsBody.appendChild(row);
    });
    
    // Update top absent - показываем только тех, у кого есть отсутствия
    const topAbsentList = document.getElementById('topAbsentList');
    topAbsentList.innerHTML = '';
    
    const topAbsentMembers = sortedMembers
        .map(m => ({ member: m, count: stats[m.id].absent }))
        .filter(item => item.count > 0) // Показываем только тех, у кого count > 0
        .sort((a, b) => b.count - a.count)
        .slice(0, 3);
    
    if (topAbsentMembers.length === 0) {
        topAbsentList.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 20px;">Нет данных об отсутствиях</p>';
    } else {
        topAbsentMembers.forEach((item, index) => {
            const div = document.createElement('div');
            div.className = 'top-item error';
            div.innerHTML = `
                <div class="top-rank error">${index + 1}.</div>
                <div class="top-info">
                    <div class="top-name">${escapeHtml(item.member.name)}</div>
                    <div class="top-count">Отсутствий: ${item.count}</div>
                </div>
            `;
            topAbsentList.appendChild(div);
        });
    }
    
    // Update top valid absent - показываем только тех, у кого есть уважительные причины
    const topAbsentValidList = document.getElementById('topAbsentValidList');
    topAbsentValidList.innerHTML = '';
    
    const topValidAbsentMembers = sortedMembers
        .map(m => ({ member: m, count: stats[m.id].valid_absent }))
        .filter(item => item.count > 0) // Показываем только тех, у кого count > 0
        .sort((a, b) => b.count - a.count)
        .slice(0, 3);
    
    if (topValidAbsentMembers.length === 0) {
        topAbsentValidList.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 20px;">Нет данных об уважительных причинах</p>';
    } else {
        topValidAbsentMembers.forEach((item, index) => {
            const div = document.createElement('div');
            div.className = 'top-item warning';
            div.innerHTML = `
                <div class="top-rank warning">${index + 1}.</div>
                <div class="top-info">
                    <div class="top-name">${escapeHtml(item.member.name)}</div>
                    <div class="top-count">Уважительные причины: ${item.count}</div>
                </div>
            `;
            topAbsentValidList.appendChild(div);
        });
    }
}

// Event listeners
function attachEventListeners() {
    document.getElementById('addMemberBtn').addEventListener('click', addMember);
    document.getElementById('newMemberInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addMember();
    });
    
    document.getElementById('dateInput').addEventListener('change', () => {
        renderAttendanceTable();
    });
    
    document.getElementById('sortSelect').addEventListener('change', () => {
        renderAttendanceTable();
    });
    
    document.getElementById('generateReportBtn').addEventListener('click', generateReport);
}

// Utility function to escape HTML
function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

// Start app
document.addEventListener('DOMContentLoaded', init);