// hours-calculator.js
// Grid-style calculator: employees as rows, days of the week as columns.
// Free-text shift entry (ex. "8 à 5", "4.45 à 9") with automatic AM/PM guess
// and clickable AM/PM chips to correct the guess when needed.

(function () {
    'use strict';

    const DAY_NAMES = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
    const MONTH_NAMES_SHORT = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
    const CODE_LETTERS = ['V', 'A', 'C', 'N', 'E', 'S'];
    // Même règle que services/schedulingAlgorithm.js : un quart de 6h ou plus se voit
    // déduire une pause (Employee.lunchBreakMinutes, 60 min par défaut).
    const BREAK_THRESHOLD_MINUTES = 360;
    const DEPARTMENTS = [
        { value: 'caisses_avant', label: 'Caisses avant' },
        { value: 'plancher', label: 'Plancher' },
        { value: 'cosmetiques', label: 'Cosmétiques' },
        { value: 'laboratoire', label: 'Laboratoire' }
    ];

    const currentDepartment = localStorage.getItem('currentDepartment') || 'caisses_avant';

    const departmentSelectEl = document.getElementById('department-select');
    const weeksContainerEl = document.getElementById('weeks-container');
    const addEmployeeBtn = document.getElementById('add-employee-btn');
    const addWeekBtn = document.getElementById('add-week-btn');
    const grandTotalCell = document.getElementById('grand-total-cell');
    const breakMinutesInput = document.getElementById('break-minutes-input');
    const saveScheduleBtn = document.getElementById('save-schedule-btn');
    const saveStatusEl = document.getElementById('save-status');

    let employees = [];
    let weeks = [];
    let dbEmployees = [];
    let dbShifts = [];
    let currentDepartmentState = currentDepartment;
    let nextEmployeeId = 1;
    let nextWeekId = 1;
    let globalBreakMinutes = parseFloat(breakMinutesInput.value) || 60;

    async function fetchDbEmployees() {
        try {
            const res = await fetch(`/api/employees?department=${currentDepartmentState}`);
            dbEmployees = await res.json();
            // Même ordre que la page principale (index) : tri par ancienneté croissante.
            dbEmployees.sort((a, b) => {
                const sA = a.seniority !== undefined ? a.seniority : 10;
                const sB = b.seniority !== undefined ? b.seniority : 10;
                return sA - sB;
            });
            render();
        } catch (err) {
            console.error('Impossible de charger les employés depuis la base de données.', err);
        }
    }

    async function fetchAllShiftsAcrossDepartments() {
        try {
            const res = await fetch(`/api/shifts?department=${currentDepartmentState}`);
            dbShifts = await res.json();
            return dbShifts;
        } catch (err) {
            console.error('Impossible de charger les quarts existants depuis la base de données.', err);
            dbShifts = [];
            return [];
        }
    }

    // Convert a stored 24h "HH:MM" time into a 12h token/period usable by the cell editor.
    function timeStringTo12Hour(hhmm) {
        const [hStr, mStr] = hhmm.split(':');
        const h = parseInt(hStr, 10);
        const m = parseInt(mStr, 10);
        const hour12 = h % 12 === 0 ? 12 : h % 12;
        const period = h < 12 ? 'AM' : 'PM';
        const token = m === 0 ? `${hour12}` : `${hour12}.${String(m).padStart(2, '0')}`;
        return { token, period, hour: hour12, minute: m };
    }

    function shiftDocToCell(shiftDoc) {
        if (shiftDoc.code) {
            const cell = createEmptyCell();
            cell.raw = shiftDoc.code;
            cell.isCode = true;
            cell.code = shiftDoc.code;
            return cell;
        }

        const startInfo = timeStringTo12Hour(shiftDoc.startTime);
        const endInfo = timeStringTo12Hour(shiftDoc.endTime);
        let raw = `${startInfo.token} à ${endInfo.token}`;
        if (shiftDoc.hasStar) raw += '*';
        else if (shiftDoc.isFormation) raw += 'F';

        const cell = createEmptyCell();
        cell.raw = raw;
        cell.start = { hour: startInfo.hour, minute: startInfo.minute };
        cell.end = { hour: endInfo.hour, minute: endInfo.minute };
        cell.startPeriod = startInfo.period;
        cell.endPeriod = endInfo.period;
        cell.marker = shiftDoc.hasStar ? '*' : (shiftDoc.isFormation ? 'f' : null);

        // Use the break minutes actually stored in the DB rather than re-guessing it,
        // so the displayed total matches exactly what was saved.
        let diff = computeRawMinutes(cell) - (shiftDoc.breakMinutes || 0);
        if (diff < 0) diff = 0;
        cell.hours = diff / 60;
        return cell;
    }

    // Pull existing shifts for a week's date range from the DB and merge them into the
    // local grid (creates employee rows for DB employees that aren't shown yet).
    async function syncWeekFromDatabase(week, allShifts) {
        const weekStartDate = parseISODate(week.weekStart);
        const dateStrings = Array.from({ length: 7 }, (_, i) => formatISODate(addDays(weekStartDate, i)));
        const shifts = allShifts || await fetchAllShiftsAcrossDepartments();
        const relevant = shifts.filter(s => dateStrings.includes(s.date));

        // Reset this week's cells to empty first so that changing the week never
        // leaves the previous week's shifts visible.
        employees.forEach(emp => {
            if (!emp.cellsByWeek[week.id]) {
                emp.cellsByWeek[week.id] = Array.from({ length: 7 }, () => createEmptyCell());
            } else {
                for (let i = 0; i < 7; i++) {
                    emp.cellsByWeek[week.id][i] = createEmptyCell();
                }
            }
        });

        relevant.forEach(shiftDoc => {
            let employee = employees.find(e => e.employeeId === shiftDoc.employeeId);
            if (!employee) {
                const dbEmp = dbEmployees.find(e => e.id === shiftDoc.employeeId);
                employee = createEmployee(dbEmp ? dbEmp.name : '');
                employee.employeeId = shiftDoc.employeeId;
                employees.push(employee);
            }
            if (!employee.cellsByWeek[week.id]) {
                employee.cellsByWeek[week.id] = Array.from({ length: 7 }, () => createEmptyCell());
            }
            const dayIndex = dateStrings.indexOf(shiftDoc.date);
            employee.cellsByWeek[week.id][dayIndex] = shiftDocToCell(shiftDoc);
        });

        render();
    }

    // Sync every visible week from a single DB fetch so the whole grid reflects
    // the up-to-date schedule for the current department.
    async function syncAllWeeksFromDatabase() {
        const allShifts = await fetchAllShiftsAcrossDepartments();
        for (const week of weeks) {
            await syncWeekFromDatabase(week, allShifts);
        }
        render();
    }

    // ---------- Date helpers ----------

    function parseISODate(str) {
        const [y, m, d] = str.split('-').map(Number);
        return new Date(y, m - 1, d);
    }

    function addDays(date, n) {
        const d = new Date(date);
        d.setDate(d.getDate() + n);
        return d;
    }

    function formatISODate(date) {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    function getDefaultWeekStart() {
        const today = new Date();
        const sunday = addDays(today, -today.getDay());
        return formatISODate(sunday);
    }

    function formatRangeLabel(weekStartStr) {
        if (!weekStartStr) return '';
        const start = parseISODate(weekStartStr);
        const end = addDays(start, 6);
        const s = `${start.getDate()} ${MONTH_NAMES_SHORT[start.getMonth()]}`;
        const e = `${end.getDate()} ${MONTH_NAMES_SHORT[end.getMonth()]} ${end.getFullYear()}`;
        return `${s} – ${e}`;
    }

    function createEmptyCell() {
        return {
            raw: '',
            isCode: false,
            invalid: false,
            marker: null, // '*' or 'f'
            code: null, // ex. 'CONGÉ' : code sans heures qui doit être enregistré dans la base
            start: null, // { hour, minute }
            end: null,
            startPeriod: 'AM',
            endPeriod: 'PM',
            hours: 0
        };
    }

    // Compare un texte au code "CONGÉ" en ignorant la casse et les accents,
    // pour accepter aussi "conge" tapé sans accent.
    function isCongeText(text) {
        return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase() === 'CONGE';
    }

    function createEmployee(name) {
        const emp = { id: nextEmployeeId++, name: name || '', employeeId: null, cellsByWeek: {} };
        weeks.forEach(week => {
            emp.cellsByWeek[week.id] = Array.from({ length: 7 }, () => createEmptyCell());
        });
        return emp;
    }

    function createWeek(weekStart) {
        const week = { id: nextWeekId++, weekStart: weekStart || getDefaultWeekStart() };
        employees.forEach(emp => {
            emp.cellsByWeek[week.id] = Array.from({ length: 7 }, () => createEmptyCell());
        });
        return week;
    }

    // ---------- Parsing ----------

    function parseTimeToken(tok) {
        const parts = tok.split(/[.:]/);
        const hour = parseInt(parts[0], 10);
        let minute = 0;
        if (parts[1]) {
            minute = parts[1].length === 1 ? parseInt(parts[1], 10) * 10 : parseInt(parts[1].slice(0, 2), 10);
        }
        return { hour, minute };
    }

    function to24Hour(time, period) {
        if (period === 'PM') {
            return time.hour === 12 ? 12 : time.hour + 12;
        }
        return time.hour === 12 ? 0 : time.hour;
    }

    function guessEndPeriod(start, startPeriod, end) {
        const startMinutes = to24Hour(start, startPeriod) * 60 + start.minute;
        const candidates = [
            { period: 'PM', minutes: to24Hour(end, 'PM') * 60 + end.minute },
            { period: 'AM', minutes: to24Hour(end, 'AM') * 60 + end.minute }
        ];
        let best = null;
        candidates.forEach(c => {
            let diff = c.minutes - startMinutes;
            if (diff < 0) diff += 24 * 60;
            if (diff >= 60 && diff <= 12 * 60) {
                if (!best || (c.period === 'PM' && best.period !== 'PM' && diff <= best.diff)) {
                    if (!best) best = { period: c.period, diff };
                }
            }
        });
        if (best) return best.period;
        return 'PM';
    }

    function computeRawMinutes(cell) {
        const startMinutes = to24Hour(cell.start, cell.startPeriod) * 60 + cell.start.minute;
        const endMinutes = to24Hour(cell.end, cell.endPeriod) * 60 + cell.end.minute;
        let diff = endMinutes - startMinutes;
        if (diff < 0) diff += 24 * 60;
        return diff;
    }

    function computeHours(cell) {
        if (cell.isCode || !cell.start || !cell.end) return 0;
        let diff = computeRawMinutes(cell);
        if (diff >= BREAK_THRESHOLD_MINUTES) {
            diff -= globalBreakMinutes;
            if (diff < 0) diff = 0;
        }
        return diff / 60;
    }

    function to24TimeString(time, period) {
        const h24 = to24Hour(time, period);
        return `${String(h24).padStart(2, '0')}:${String(time.minute).padStart(2, '0')}`;
    }

    function recomputeAllHours() {
        employees.forEach(emp => {
            Object.values(emp.cellsByWeek).forEach(cells => {
                cells.forEach(c => { c.hours = computeHours(c); });
            });
        });
    }

    function parseCellRaw(raw) {
        const cell = createEmptyCell();
        cell.raw = raw;
        const trimmed = raw.trim();

        if (!trimmed || trimmed === '-') {
            cell.isCode = true;
            return cell;
        }
        if (/^\*+$/.test(trimmed)) {
            cell.isCode = true;
            return cell;
        }
        if (isCongeText(trimmed)) {
            cell.isCode = true;
            cell.code = 'CONGÉ';
            return cell;
        }
        if (CODE_LETTERS.some(letter => letter.toLowerCase() === trimmed.toLowerCase())) {
            cell.isCode = true;
            return cell;
        }

        const match = trimmed.match(/^(\d{1,2}(?:[.:]\d{1,2})?)\s*(?:à|a|-|to)\s*(\d{1,2}(?:[.:]\d{1,2})?)\s*(\*|f)?$/i);
        if (!match) {
            cell.isCode = true;
            cell.invalid = true;
            return cell;
        }

        const start = parseTimeToken(match[1]);
        const end = parseTimeToken(match[2]);
        if (isNaN(start.hour) || isNaN(end.hour) || start.hour > 23 || end.hour > 23) {
            cell.isCode = true;
            cell.invalid = true;
            return cell;
        }

        cell.start = start;
        cell.end = end;
        cell.marker = match[3] ? match[3].toLowerCase() : null;

        // If hours are already >= 13, it's unambiguous 24h notation.
        if (start.hour >= 13) {
            cell.startPeriod = 'PM';
        } else {
            cell.startPeriod = start.hour === 12 ? 'PM' : 'AM';
        }

        if (end.hour >= 13) {
            cell.endPeriod = 'PM';
        } else {
            cell.endPeriod = guessEndPeriod(start, cell.startPeriod, end);
        }

        cell.hours = computeHours(cell);
        return cell;
    }

    function formatHours(hours) {
        const rounded = Math.round(hours * 100) / 100;
        if (Number.isInteger(rounded)) return `${rounded}`;
        return rounded.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
    }

    // ---------- Computation helpers ----------

    function computeEmployeeWeekTotal(employee, weekId) {
        const cells = employee.cellsByWeek[weekId] || [];
        const week = weeks.find(w => w.id === weekId);
        if (!week || !week.weekStart) {
            return cells.reduce((sum, c) => sum + (c.isCode ? 0 : c.hours), 0);
        }

        const weekStartDate = parseISODate(week.weekStart);
        return cells.reduce((sum, c, dayIndex) => {
            const dateString = formatISODate(addDays(weekStartDate, dayIndex));
            if (isVacationDay(employee, dateString)) return sum;
            return sum + (c.isCode ? 0 : c.hours);
        }, 0);
    }

    function computeGrandTotal() {
        let total = 0;
        employees.forEach(emp => {
            weeks.forEach(week => {
                total += computeEmployeeWeekTotal(emp, week.id);
            });
        });
        return total;
    }

    function updateGrandTotalDisplay() {
        grandTotalCell.textContent = `${formatHours(computeGrandTotal())} hrs`;
    }

    // ---------- Rendering ----------

    // Vérifie si un employé lié à la base est en vacances à une date donnée
    // (mêmes plages que celles gérées sur la page principale, index.html).
    function isVacationDay(employee, dateString) {
        if (!employee.employeeId) return false;
        const dbEmp = dbEmployees.find(e => String(e.id) === String(employee.employeeId));
        if (!dbEmp || !dbEmp.vacations) return false;
        return dbEmp.vacations.some(vac => dateString >= vac.startDate && dateString <= vac.endDate);
    }

    // Clé de tri d'une ligne : les employés liés à la base suivent exactement
    // l'ordre de la liste principale (index), les lignes non liées restent à la fin.
    function employeeOrderKey(employee) {
        if (!employee.employeeId) return Number.MAX_SAFE_INTEGER;
        const index = dbEmployees.findIndex(e => String(e.id) === String(employee.employeeId));
        return index === -1 ? Number.MAX_SAFE_INTEGER : index;
    }

    function sortEmployeeRows() {
        employees.sort((a, b) => employeeOrderKey(a) - employeeOrderKey(b));
    }

    function render() {
        sortEmployeeRows();
        weeksContainerEl.innerHTML = '';

        if (weeks.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'empty-state';
            empty.textContent = 'Cliquez sur "+ Ajouter une semaine" pour commencer.';
            weeksContainerEl.appendChild(empty);
        }

        weeks.forEach(week => {
            weeksContainerEl.appendChild(renderWeekBlock(week));
        });

        updateGrandTotalDisplay();
    }

    function renderWeekBlock(week) {
        const block = document.createElement('div');
        block.className = 'week-block';

        const header = document.createElement('div');
        header.className = 'week-block-header';

        const dateInput = document.createElement('input');
        dateInput.type = 'date';
        dateInput.className = 'week-date-input';
        dateInput.value = week.weekStart;
        dateInput.title = 'Choisir une semaine : la date sélectionnée sera ramenée au dimanche de cette semaine';

        const prevWeekBtn = document.createElement('button');
        prevWeekBtn.className = 'week-nav-btn';
        prevWeekBtn.type = 'button';
        prevWeekBtn.textContent = '‹';
        prevWeekBtn.title = 'Semaine précédente';

        const nextWeekBtn = document.createElement('button');
        nextWeekBtn.className = 'week-nav-btn';
        nextWeekBtn.type = 'button';
        nextWeekBtn.textContent = '›';
        nextWeekBtn.title = 'Semaine suivante';

        function applyWeekStart(newStart) {
            week.weekStart = newStart;
            dateInput.value = week.weekStart;
            render();
            syncWeekFromDatabase(week);
        }

        dateInput.addEventListener('change', () => {
            if (dateInput.value) {
                const picked = parseISODate(dateInput.value);
                const sunday = addDays(picked, -picked.getDay());
                applyWeekStart(formatISODate(sunday));
            } else {
                applyWeekStart(getDefaultWeekStart());
            }
        });

        prevWeekBtn.addEventListener('click', () => {
            applyWeekStart(formatISODate(addDays(parseISODate(week.weekStart), -7)));
        });

        nextWeekBtn.addEventListener('click', () => {
            applyWeekStart(formatISODate(addDays(parseISODate(week.weekStart), 7)));
        });

        const rangeLabel = document.createElement('span');
        rangeLabel.className = 'week-range-label';
        rangeLabel.textContent = formatRangeLabel(week.weekStart);

        const removeWeekBtn = document.createElement('button');
        removeWeekBtn.className = 'btn-danger-outline';
        removeWeekBtn.textContent = '✕ Retirer la semaine';
        removeWeekBtn.addEventListener('click', () => {
            weeks = weeks.filter(w => w.id !== week.id);
            employees.forEach(emp => { delete emp.cellsByWeek[week.id]; });
            render();
        });

        header.appendChild(prevWeekBtn);
        header.appendChild(dateInput);
        header.appendChild(nextWeekBtn);
        header.appendChild(rangeLabel);
        header.appendChild(removeWeekBtn);
        block.appendChild(header);

        const scroll = document.createElement('div');
        scroll.className = 'week-table-scroll';

        const table = document.createElement('table');
        table.className = 'hours-grid';

        const thead = document.createElement('thead');
        const headRow = document.createElement('tr');
        const nameHeaderTh = document.createElement('th');
        nameHeaderTh.className = 'col-name-header';
        nameHeaderTh.textContent = 'Nom';
        headRow.appendChild(nameHeaderTh);

        DAY_NAMES.forEach((dayName, idx) => {
            const th = document.createElement('th');

            const nameSpan = document.createElement('span');
            nameSpan.className = 'day-header-name';
            nameSpan.textContent = dayName;
            th.appendChild(nameSpan);

            if (week.weekStart) {
                const dateSpan = document.createElement('span');
                dateSpan.className = 'day-header-date';
                const dayDate = addDays(parseISODate(week.weekStart), idx);
                dateSpan.textContent = `${dayDate.getDate()} ${MONTH_NAMES_SHORT[dayDate.getMonth()]}`;
                th.appendChild(dateSpan);
            }

            headRow.appendChild(th);
        });

        const totalTh = document.createElement('th');
        totalTh.textContent = 'Total';
        headRow.appendChild(totalTh);

        const actionsTh = document.createElement('th');
        actionsTh.className = 'col-actions-header';
        headRow.appendChild(actionsTh);

        thead.appendChild(headRow);
        table.appendChild(thead);

        const tbody = document.createElement('tbody');

        if (employees.length === 0) {
            const tr = document.createElement('tr');
            const td = document.createElement('td');
            td.colSpan = 10;
            td.className = 'empty-state';
            td.textContent = 'Aucun employé. Cliquez sur "+ Ajouter un employé".';
            tr.appendChild(td);
            tbody.appendChild(tr);
        }

        employees.forEach(employee => {
            tbody.appendChild(renderEmployeeRow(employee, week));
        });

        table.appendChild(tbody);
        scroll.appendChild(table);
        block.appendChild(scroll);

        return block;
    }

    function renderEmployeeRow(employee, week) {
        const tr = document.createElement('tr');

        const nameTd = document.createElement('td');
        nameTd.className = 'col-name';

        const select = document.createElement('select');
        select.className = 'employee-select';

        const blankOption = document.createElement('option');
        blankOption.value = '';
        blankOption.textContent = '— Sélectionner —';
        select.appendChild(blankOption);

        const customOption = document.createElement('option');
        customOption.value = '__custom__';
        customOption.textContent = 'Autre (non enregistré)';
        select.appendChild(customOption);

        const deptEmployees = dbEmployees.filter(e => e.department === currentDepartmentState);
        if (deptEmployees.length > 0) {
            const group = document.createElement('optgroup');
            group.label = DEPARTMENTS.find(d => d.value === currentDepartmentState).label;
            deptEmployees.forEach(e => {
                const opt = document.createElement('option');
                opt.value = e.id;
                opt.textContent = e.name;
                group.appendChild(opt);
            });
            select.appendChild(group);
        }

        if (employee.employeeId) {
            select.value = employee.employeeId;
        } else if (employee.name) {
            select.value = '__custom__';
        } else {
            select.value = '';
        }

        const customInput = document.createElement('input');
        customInput.type = 'text';
        customInput.className = 'employee-name-input';
        customInput.placeholder = 'Nom';
        customInput.value = employee.employeeId ? '' : employee.name;
        customInput.style.display = (select.value === '__custom__') ? 'block' : 'none';

        select.addEventListener('change', () => {
            if (select.value === '__custom__') {
                employee.employeeId = null;
                customInput.style.display = 'block';
                customInput.focus();
            } else if (select.value === '') {
                employee.employeeId = null;
                employee.name = '';
                customInput.style.display = 'none';
                customInput.value = '';
            } else {
                employee.employeeId = select.value;
                const matched = dbEmployees.find(e => e.id === select.value);
                employee.name = matched ? matched.name : '';
                customInput.style.display = 'none';
            }
            render();
        });

        customInput.addEventListener('input', () => { employee.name = customInput.value; });

        nameTd.appendChild(select);
        nameTd.appendChild(customInput);
        tr.appendChild(nameTd);

        const cells = employee.cellsByWeek[week.id];
        const weekStartDate = week.weekStart ? parseISODate(week.weekStart) : null;

        for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
            const dateString = weekStartDate ? formatISODate(addDays(weekStartDate, dayIndex)) : null;
            tr.appendChild(renderDayCell(employee, week, dayIndex, cells[dayIndex], tr, dateString));
        }

        const totalTd = document.createElement('td');
        totalTd.className = 'col-total';
        totalTd.textContent = `${formatHours(computeEmployeeWeekTotal(employee, week.id))} hrs`;
        tr.appendChild(totalTd);

        const actionsTd = document.createElement('td');
        actionsTd.className = 'col-actions';
        const removeBtn = document.createElement('button');
        removeBtn.className = 'remove-row-btn';
        removeBtn.textContent = '✕';
        removeBtn.title = 'Retirer cet employé';
        removeBtn.addEventListener('click', () => {
            employees = employees.filter(e => e.id !== employee.id);
            render();
        });
        actionsTd.appendChild(removeBtn);
        tr.appendChild(actionsTd);

        return tr;
    }

    function renderDayCell(employee, week, dayIndex, cell, rowEl, dateString) {
        const td = document.createElement('td');
        td.className = 'col-day';

        if (dateString && isVacationDay(employee, dateString)) {
            td.classList.add('col-day-vacation');
            const badge = document.createElement('span');
            badge.className = 'vacation-badge';
            badge.textContent = 'Vacances';
            td.appendChild(badge);
            return td;
        }

        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'day-cell-input';
        input.placeholder = '-';
        input.value = cell.raw;
        if (cell.invalid) input.classList.add('invalid-shift');

        const hoursLabel = document.createElement('div');
        hoursLabel.className = 'day-cell-hours';

        const toggles = document.createElement('div');
        toggles.className = 'period-toggles';

        const startChip = document.createElement('button');
        startChip.type = 'button';
        startChip.className = 'period-chip';

        const endChip = document.createElement('button');
        endChip.type = 'button';
        endChip.className = 'period-chip';

        function refreshDisplay() {
            hoursLabel.textContent = cell.isCode ? (cell.invalid ? '?' : '') : `${formatHours(cell.hours)} h`;
            input.classList.toggle('invalid-shift', !!cell.invalid);
            input.classList.toggle('formation-shift', cell.marker === 'f');

            if (cell.isCode || !cell.start) {
                toggles.classList.add('hidden');
            } else {
                toggles.classList.remove('hidden');
                startChip.textContent = cell.startPeriod;
                startChip.classList.toggle('is-pm', cell.startPeriod === 'PM');
                endChip.textContent = cell.endPeriod;
                endChip.classList.toggle('is-pm', cell.endPeriod === 'PM');
            }
        }

        startChip.addEventListener('click', () => {
            cell.startPeriod = cell.startPeriod === 'AM' ? 'PM' : 'AM';
            cell.hours = computeHours(cell);
            refreshDisplay();
            updateRowAndGrandTotals(rowEl, employee, week);
        });

        endChip.addEventListener('click', () => {
            cell.endPeriod = cell.endPeriod === 'AM' ? 'PM' : 'AM';
            cell.hours = computeHours(cell);
            refreshDisplay();
            updateRowAndGrandTotals(rowEl, employee, week);
        });

        input.addEventListener('input', () => {
            const parsed = parseCellRaw(input.value);
            parsed.hours = computeHours(parsed);
            employee.cellsByWeek[week.id][dayIndex] = parsed;
            cell = parsed;
            refreshDisplay();
            updateRowAndGrandTotals(rowEl, employee, week);
        });

        toggles.appendChild(startChip);
        toggles.appendChild(endChip);

        refreshDisplay();

        td.appendChild(input);
        td.appendChild(hoursLabel);
        td.appendChild(toggles);

        return td;
    }

    function updateRowAndGrandTotals(rowEl, employee, week) {
        const totalTd = rowEl.querySelector('.col-total');
        if (totalTd) {
            totalTd.textContent = `${formatHours(computeEmployeeWeekTotal(employee, week.id))} hrs`;
        }
        updateGrandTotalDisplay();
    }

    // ---------- Save to database ----------

    async function saveScheduleToDatabase() {
        const shiftsToSave = [];
        const shiftsToDelete = [];
        const skippedEmployeeNames = new Set();

        employees.forEach(employee => {
            weeks.forEach(week => {
                const cells = employee.cellsByWeek[week.id] || [];
                cells.forEach((cell, dayIndex) => {
                    const date = formatISODate(addDays(parseISODate(week.weekStart), dayIndex));
                    if (!employee.employeeId) {
                        if (employee.name) skippedEmployeeNames.add(employee.name);
                        return;
                    }

                    const dbEmp = dbEmployees.find(e => String(e.id) === String(employee.employeeId));
                    if (!dbEmp) return;

                    const existingShift = dbShifts.find(shift =>
                        String(shift.employeeId) === String(employee.employeeId) && shift.date === date
                    );

                    // Une journée de vacances remplace tout quart sous-jacent : on le
                    // supprime de la base pour qu'il ne réapparaisse pas au rechargement.
                    if (isVacationDay(employee, date)) {
                        if (existingShift) shiftsToDelete.push(existingShift);
                        return;
                    }

                    // Les codes sans heures (V, A, C, N, E, S) restent purement visuels, sauf
                    // "CONGÉ" qui doit être enregistré comme un vrai quart (cell.code).
                    if (cell.isCode && !cell.code) {
                        if (existingShift) shiftsToDelete.push(existingShift);
                        return;
                    }
                    if (!cell.isCode && (!cell.start || !cell.end)) {
                        if (existingShift) shiftsToDelete.push(existingShift);
                        return;
                    }

                    if (cell.code) {
                        shiftsToSave.push({
                            employeeId: employee.employeeId,
                            date,
                            code: cell.code,
                            department: dbEmp.department,
                            force: true
                        });
                        return;
                    }

                    const rawMinutes = computeRawMinutes(cell);

                    shiftsToSave.push({
                        employeeId: employee.employeeId,
                        date,
                        startTime: to24TimeString(cell.start, cell.startPeriod),
                        endTime: to24TimeString(cell.end, cell.endPeriod),
                        breakMinutes: rawMinutes >= BREAK_THRESHOLD_MINUTES ? globalBreakMinutes : 0,
                        department: dbEmp.department,
                        isFormation: cell.marker === 'f',
                        hasStar: cell.marker === '*',
                        force: true
                    });
                });
            });
        });

        const uniqueShiftsToDelete = [...new Map(
            shiftsToDelete.map(shift => [shift.id || shift._id, shift])
        ).values()];

        if (shiftsToSave.length === 0 && uniqueShiftsToDelete.length === 0) {
            saveStatusEl.textContent = skippedEmployeeNames.size > 0
                ? `Aucun quart à enregistrer. Associez d'abord "${[...skippedEmployeeNames].join(', ')}" à un employé enregistré.`
                : 'Aucun quart à enregistrer.';
            saveStatusEl.className = 'save-status save-status-warning';
            return;
        }

        saveScheduleBtn.disabled = true;
        saveStatusEl.textContent = `Enregistrement de ${shiftsToSave.length + uniqueShiftsToDelete.length} modification(s)...`;
        saveStatusEl.className = 'save-status';

        let successCount = 0;
        const errors = [];

        for (const shift of uniqueShiftsToDelete) {
            try {
                const shiftId = shift.id || shift._id;
                const res = await fetch(`/api/shifts/${shiftId}`, { method: 'DELETE' });
                if (!res.ok) {
                    const body = await res.json().catch(() => ({}));
                    errors.push(`${shift.date} : ${body.message || res.statusText}`);
                } else {
                    successCount++;
                }
            } catch (err) {
                errors.push(`${shift.date} : ${err.message}`);
            }
        }

        for (const shift of shiftsToSave) {
            try {
                const res = await fetch('/api/shifts', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(shift)
                });
                if (!res.ok) {
                    const body = await res.json().catch(() => ({}));
                    errors.push(`${shift.date} : ${body.message || res.statusText}`);
                } else {
                    successCount++;
                }
            } catch (err) {
                errors.push(`${shift.date} : ${err.message}`);
            }
        }

        saveScheduleBtn.disabled = false;

        let message = `${successCount} quart(s) enregistré(s) avec succès.`;
        if (skippedEmployeeNames.size > 0) {
            message += ` Ignoré (non lié à un employé enregistré) : ${[...skippedEmployeeNames].join(', ')}.`;
        }
        if (errors.length > 0) {
            message += ` Erreurs (${errors.length}) : ${errors.slice(0, 5).join(' | ')}`;
        }
        saveStatusEl.textContent = message;
        saveStatusEl.className = `save-status ${errors.length > 0 ? 'save-status-error' : 'save-status-success'}`;

        // Re-sync every visible week from the DB so the grid reflects exactly what
        // was persisted (and stays in sync with the main schedule page).
        await syncAllWeeksFromDatabase();
    }

    // ---------- Wiring ----------

    addEmployeeBtn.addEventListener('click', () => {
        employees.push(createEmployee(''));
        render();
    });

    addWeekBtn.addEventListener('click', () => {
        const lastWeek = weeks[weeks.length - 1];
        const nextStart = lastWeek
            ? formatISODate(addDays(parseISODate(lastWeek.weekStart), 7))
            : getDefaultWeekStart();
        const newWeek = createWeek(nextStart);
        weeks.push(newWeek);
        render();
        syncWeekFromDatabase(newWeek);
    });

    breakMinutesInput.addEventListener('input', () => {
        globalBreakMinutes = parseFloat(breakMinutesInput.value) || 0;
        recomputeAllHours();
        render();
    });

    saveScheduleBtn.addEventListener('click', () => {
        saveScheduleToDatabase();
    });

    // Start with a sensible default: one week, no employee rows yet.
    weeks.push(createWeek(getDefaultWeekStart()));
    
    // Initialize department selector (options are already declared in the HTML)
    departmentSelectEl.value = currentDepartmentState;

    departmentSelectEl.addEventListener('change', async () => {
        currentDepartmentState = departmentSelectEl.value;
        localStorage.setItem('currentDepartment', currentDepartmentState);
        employees = [];
        await fetchDbEmployees();
        await syncAllWeeksFromDatabase();
        render();
    });

    render();

    (async function initialLoad() {
        await fetchDbEmployees();
        await syncAllWeeksFromDatabase();
    })();
})();
