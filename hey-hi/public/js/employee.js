document.addEventListener('DOMContentLoaded', async () => {
    const dayNames = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
    const monthNames = ['janv.', 'fév.', 'mars', 'avr.', 'mai', 'juin', 'juill.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

    const nameTitle = document.getElementById('employee-name-title');
    const logoutBtn = document.getElementById('logout-btn');
    const saveBtn = document.getElementById('save-btn');
    const saveStatus = document.getElementById('save-status');
    const weekContainer = document.getElementById('week-container');
    const weekSelect = document.getElementById('week-select');
    const prevWeekBtn = document.getElementById('prev-week');
    const nextWeekBtn = document.getElementById('next-week');
    const copyBtn = document.getElementById('copy-next-week');

    let employee = null;
    let isGuest = false;

    const WEEKS_PAST = 1;
    const WEEKS_FUTURE = 12;

    const currentWeekStart = AppUtils.getStartOfWeek(new Date());
    let selectedWeekStart = new Date(currentWeekStart);

    function weekStartKey(date) {
        return AppUtils.formatDate(date);
    }

    function weekLabel(date) {
        const end = new Date(date);
        end.setDate(end.getDate() + 6);
        const sameMonth = date.getMonth() === end.getMonth() && date.getFullYear() === end.getFullYear();
        if (sameMonth) {
            return `Du ${date.getDate()} au ${end.getDate()} ${monthNames[end.getMonth()]} ${end.getFullYear()}`;
        }
        return `Du ${date.getDate()} ${monthNames[date.getMonth()]} au ${end.getDate()} ${monthNames[end.getMonth()]} ${end.getFullYear()}`;
    }

    function populateWeekSelect() {
        weekSelect.innerHTML = '';
        for (let i = -WEEKS_PAST; i <= WEEKS_FUTURE; i++) {
            const d = new Date(currentWeekStart);
            d.setDate(d.getDate() + i * 7);
            const option = document.createElement('option');
            option.value = weekStartKey(d);
            option.textContent = weekLabel(d);
            weekSelect.appendChild(option);
        }
        weekSelect.value = weekStartKey(selectedWeekStart);
    }

    function setSelectedWeek(date) {
        selectedWeekStart = new Date(date);
        const key = weekStartKey(selectedWeekStart);
        if (![...weekSelect.options].some(o => o.value === key)) {
            const option = document.createElement('option');
            option.value = key;
            option.textContent = weekLabel(selectedWeekStart);
            weekSelect.appendChild(option);
        }
        weekSelect.value = key;
        renderAvailabilities();
    }

    logoutBtn.addEventListener('click', async () => {
        try {
            await fetch('/api/auth/logout', { method: 'POST' });
        } finally {
            window.location.href = '/login.html';
        }
    });

    weekSelect.addEventListener('change', () => {
        setSelectedWeek(AppUtils.parseLocalDate(weekSelect.value));
    });

    prevWeekBtn.addEventListener('click', () => {
        const d = new Date(selectedWeekStart);
        d.setDate(d.getDate() - 7);
        setSelectedWeek(d);
    });

    nextWeekBtn.addEventListener('click', () => {
        const d = new Date(selectedWeekStart);
        d.setDate(d.getDate() + 7);
        setSelectedWeek(d);
    });

    copyBtn.addEventListener('click', () => {
        if (isGuest) {
            alert("Mode invité : cette action est désactivée. Aucune modification n'est enregistrée.");
            return;
        }
        if (!confirm("Voulez-vous copier ces disponibilités vers la semaine suivante ?")) return;
        const values = [];
        for (let i = 0; i < 7; i++) {
            values.push({
                checked: document.getElementById(`avail-check-${i}`).checked,
                start: AppUtils.normalizeTime(document.getElementById(`avail-start-${i}`).value) || '08:00',
                end: AppUtils.normalizeTime(document.getElementById(`avail-end-${i}`).value) || '17:00'
            });
        }
        const nextWeek = new Date(selectedWeekStart);
        nextWeek.setDate(nextWeek.getDate() + 7);
        const nextKey = weekStartKey(nextWeek);
        const otherAvailabilities = (employee.availabilities || []).filter(a => a.weekStart !== nextKey);
        const newAvailabilities = values.map((v, i) => {
            const defaultHours = AppUtils.getPharmacyHours(i);
            return {
                dayOfWeek: i,
                weekStart: nextKey,
                isAvailable: v.checked,
                startTime: v.checked ? (v.start || '08:00') : defaultHours.open,
                endTime: v.checked ? (v.end || '17:00') : defaultHours.close
            };
        });
        employee.availabilities = otherAvailabilities.concat(newAvailabilities);
        alert('Disponibilités copiées vers la semaine suivante.');
    });

    function renderAvailabilities() {
        weekContainer.innerHTML = '';

        const weekKey = weekStartKey(selectedWeekStart);
        const allAvailabilities = employee.availabilities || [];
        const weekAvailabilities = allAvailabilities.filter(a => (a.weekStart || null) === weekKey);
        const legacyAvailabilities = allAvailabilities.filter(a => !a.weekStart);
        const availabilities = weekAvailabilities.length ? weekAvailabilities : legacyAvailabilities;

        for (let index = 0; index < 7; index++) {
            const dayName = dayNames[index];
            const d = new Date(selectedWeekStart);
            d.setDate(d.getDate() + index);
            const dateLabel = `${dayName} ${d.getDate()} ${monthNames[d.getMonth()]}`;

            let avail = availabilities.find(a => a.dayOfWeek === index);
            if (!avail) {
                avail = { isAvailable: true, startTime: '08:00', endTime: '17:00' };
            }

            const row = document.createElement('div');
            row.className = 'avail-row';
            row.innerHTML = `
                <div class="day-label">${dateLabel}</div>
                <div>
                    <input type="checkbox" id="avail-check-${index}" data-day="${index}" ${avail.isAvailable ? 'checked' : ''}>
                    <label for="avail-check-${index}">Disponible</label>
                </div>
                <div>
                    <input type="text" id="avail-start-${index}" value="${avail.startTime}" maxlength="5" ${!avail.isAvailable ? 'disabled' : ''}>
                    à
                    <input type="text" id="avail-end-${index}" value="${avail.endTime}" maxlength="5" ${!avail.isAvailable ? 'disabled' : ''}>
                </div>
            `;

            weekContainer.appendChild(row);

            const checkbox = row.querySelector(`#avail-check-${index}`);
            const startInput = row.querySelector(`#avail-start-${index}`);
            const endInput = row.querySelector(`#avail-end-${index}`);

            startInput.dataset.lastValid = avail.startTime;
            endInput.dataset.lastValid = avail.endTime;

            checkbox.addEventListener('change', (e) => {
                startInput.disabled = !e.target.checked;
                endInput.disabled = !e.target.checked;
            });
            startInput.addEventListener('input', AppUtils.formatTimeInput);
            endInput.addEventListener('input', AppUtils.formatTimeInput);
            startInput.addEventListener('blur', () => AppUtils.enforceTimeBounds(startInput, index));
            endInput.addEventListener('blur', () => AppUtils.enforceTimeBounds(endInput, index));
        }
    }

    saveBtn.addEventListener('click', async () => {
        if (isGuest) {
            alert("Mode invité : cette action est désactivée. Aucune modification n'est enregistrée.");
            return;
        }
        const availabilities = [];
        for (let i = 0; i < 7; i++) {
            const isAvail = document.getElementById(`avail-check-${i}`).checked;

            if (!isAvail) {
                const defaultHours = AppUtils.getPharmacyHours(i);
                availabilities.push({ dayOfWeek: i, isAvailable: false, startTime: defaultHours.open, endTime: defaultHours.close });
                continue;
            }

            const startInput = document.getElementById(`avail-start-${i}`);
            const endInput = document.getElementById(`avail-end-${i}`);
            const start = AppUtils.normalizeTime(startInput.value);
            const end = AppUtils.normalizeTime(endInput.value);
            const dayLabel = dayNames[i];

            if (!start || !end) {
                alert(`Heure invalide pour ${dayLabel}. Utilisez le format HH:MM (ex: 09:00).`);
                (start ? endInput : startInput).focus();
                return;
            }
            if (AppUtils.timeToMinutes(start) >= AppUtils.timeToMinutes(end)) {
                alert(`${dayLabel} : l'heure de début doit être avant l'heure de fin.`);
                startInput.focus();
                return;
            }

            startInput.value = start;
            endInput.value = end;

            availabilities.push({
                dayOfWeek: i,
                isAvailable: true,
                startTime: start,
                endTime: end
            });
        }

        saveStatus.textContent = '';
        saveStatus.style.color = '';

        try {
            const res = await fetch('/api/employees/me/availability', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ availabilities, weekStart: weekStartKey(selectedWeekStart) })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Erreur lors de la sauvegarde');
            employee = data;
            saveStatus.textContent = 'Disponibilités sauvegardées avec succès !';
            saveStatus.style.color = 'var(--primary-color)';
        } catch (err) {
            saveStatus.textContent = 'Erreur : ' + err.message;
            saveStatus.style.color = 'var(--danger-color)';
        }
    });

    try {
        const res = await fetch('/api/employees/me');
        if (!res.ok) throw new Error('Impossible de charger votre profil');
        employee = await res.json();
        isGuest = employee.id === 'guest';
        if (isGuest) {
            const banner = document.getElementById('guest-banner');
            if (banner) banner.classList.remove('hidden');
        }
        nameTitle.textContent = `Mes disponibilités - ${employee.name}`;
        populateWeekSelect();
        renderAvailabilities();
    } catch (err) {
        saveStatus.textContent = 'Erreur : ' + err.message;
        saveStatus.style.color = 'var(--danger-color)';
    }
});
