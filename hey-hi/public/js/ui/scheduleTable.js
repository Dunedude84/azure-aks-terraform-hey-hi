Object.assign(AppUI, {
renderScheduleTable() {
    const startDate = AppUtils.getStartOfWeek(AppState.currentDate);
    const startYear = startDate.getFullYear();
    const startMonth = startDate.getMonth();
    const startGridDate = startDate.getDate();

    const dayNames = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
    const daysPerTable = 7; // 1 semaine par tableau

    this.elements.scheduleThead1.innerHTML = '';
    this.elements.scheduleTbody1.innerHTML = '';
    this.elements.scheduleThead2.innerHTML = '';
    this.elements.scheduleTbody2.innerHTML = '';

    // 1. Render Theads
    const trHead1 = document.createElement('tr');
    trHead1.innerHTML = '<th>Employés</th>';
    for (let i = 0; i < daysPerTable; i++) {
        const date = new Date(startYear, startMonth, startGridDate + i);
        const th = document.createElement('th');

        if (date.getDay() === 0 || date.getDay() === 6) {
            th.style.color = 'var(--danger-color)';
        }
        th.innerHTML = `${dayNames[date.getDay()]}<br>${date.getDate()}`;
        trHead1.appendChild(th);
    }
    this.elements.scheduleThead1.appendChild(trHead1);

    const trHead2 = document.createElement('tr');
    trHead2.innerHTML = '<th>Employés</th>';
    for (let i = 0; i < daysPerTable; i++) {
        const date = new Date(startYear, startMonth, startGridDate + daysPerTable + i);

        const th = document.createElement('th');
        if (date.getDay() === 0 || date.getDay() === 6) {
            th.style.color = 'var(--danger-color)';
        }
        th.innerHTML = `${dayNames[date.getDay()]}<br>${date.getDate()}`;
        trHead2.appendChild(th);
    }
    this.elements.scheduleThead2.appendChild(trHead2);

    // 2. Empty state
    if (AppState.employees.length === 0) {
        const tr1 = document.createElement('tr');
        tr1.innerHTML = `<td colspan="${daysPerTable + 1}" style="padding: 20px; color: var(--text-muted)">Aucun employé enregistré.</td>`;
        this.elements.scheduleTbody1.appendChild(tr1);

        const tr2 = document.createElement('tr');
        tr2.innerHTML = `<td colspan="${daysPerTable + 1}" style="padding: 20px; color: var(--text-muted)">Aucun employé enregistré.</td>`;
        this.elements.scheduleTbody2.appendChild(tr2);
        return;
    }

    const shiftMap = {};
    AppState.shifts.forEach(shift => {
        if (!shiftMap[shift.employeeId]) shiftMap[shift.employeeId] = {};
        shiftMap[shift.employeeId][shift.date] = shift;
    });

    // 3. Render Employees Rows
    AppState.employees.forEach(employee => {
        const tr1 = document.createElement('tr');
        const tr2 = document.createElement('tr');

        let nameHtml = `<span class="employee-name-btn" style="cursor: pointer; color: var(--primary-color); font-size: 1.2rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; display: inline-block; max-width: 100%; text-decoration: underline;" title="${employee.name}">${employee.name}</span>`;

        const nameTd1 = document.createElement('td');
        nameTd1.className = 'employee-cell';
        nameTd1.innerHTML = nameHtml;
        nameTd1.querySelector('.employee-name-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            const startStr = `${startYear}-${String(startMonth + 1).padStart(2, '0')}-${String(startGridDate).padStart(2, '0')}`;
            const endObj = new Date(startYear, startMonth, startGridDate + 13);
            const endStr = `${endObj.getFullYear()}-${String(endObj.getMonth() + 1).padStart(2, '0')}-${String(endObj.getDate()).padStart(2, '0')}`;
            this.openEmployeeActionModal(employee, startStr, endStr);
        });
        tr1.appendChild(nameTd1);

        const nameTd2 = document.createElement('td');
        nameTd2.className = 'employee-cell';
        nameTd2.innerHTML = nameHtml;
        nameTd2.querySelector('.employee-name-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            const startStr = `${startYear}-${String(startMonth + 1).padStart(2, '0')}-${String(startGridDate).padStart(2, '0')}`;
            const endObj = new Date(startYear, startMonth, startGridDate + 13);
            const endStr = `${endObj.getFullYear()}-${String(endObj.getMonth() + 1).padStart(2, '0')}-${String(endObj.getDate()).padStart(2, '0')}`;
            this.openEmployeeActionModal(employee, startStr, endStr);
        });
        tr2.appendChild(nameTd2);

        for (let i = 0; i < daysPerTable * 2; i++) {
            const dateObj = new Date(startYear, startMonth, startGridDate + i);

            const td = document.createElement('td');
            td.className = 'shift-cell';

            const y = dateObj.getFullYear();
            const m = String(dateObj.getMonth() + 1).padStart(2, '0');
            const d = String(dateObj.getDate()).padStart(2, '0');
            const dateString = `${y}-${m}-${d}`;

            if (dateObj.getDay() === 0 || dateObj.getDay() === 6) {
                td.classList.add('is-weekend');
            }

            const isVacationDay = (employee.vacations || []).some(vac => dateString >= vac.startDate && dateString <= vac.endDate);
            const shift = shiftMap[employee.id] && shiftMap[employee.id][dateString];

            if (isVacationDay) {
                const block = document.createElement('div');
                block.className = 'shift-block';
                block.style.background = '#fef08a';
                block.style.color = '#854d0e';
                block.style.border = '1px solid #fde047';
                block.style.justifyContent = 'center';
                block.innerHTML = `<span style="font-weight:600;">Vacances</span>`;
                td.appendChild(block);
            } else if (shift && shift.code) {
                const block = document.createElement('div');
                block.className = 'shift-block';
                block.style.background = '#fef08a';
                block.style.color = '#854d0e';
                block.style.border = '1px solid #fde047';
                block.style.justifyContent = 'center';
                block.innerHTML = `<span style="font-weight:600;">${shift.code === 'CONGÉ' ? 'Congé' : shift.code}</span>`;
                td.appendChild(block);
            } else {
                if (shift) {
                    const block = document.createElement('div');
                    block.className = 'shift-block';
                    if (shift.isFormation) {
                        block.classList.add('is-formation');
                    }
                    const compactTime = (t, suffix = '') => {
                        const [h, m] = t.split(':');
                        const hh = parseInt(h, 10);
                        return m === '00' ? `${hh}${suffix}` : `${hh}h${m}${suffix}`;
                    };
                    const startDisplay = compactTime(shift.startTime);
                    let endTimeDisplay = compactTime(shift.endTime, 'h');
                    if (shift.hasStar) {
                        endTimeDisplay += `<b style="font-size:1.2rem; color:#dc2626; margin-left:2px; vertical-align:middle; display:inline-block; margin-top:-2px;">*</b>`;
                    }
                    if (shift.isFormation) {
                        block.innerHTML = `<span>${startDisplay}-${endTimeDisplay}</span> <b style="font-size:1.2rem; color:#7e22ce;">F</b>`;
                    } else {
                        block.innerHTML = `<span>${startDisplay}-${endTimeDisplay}</span>`;
                    }

                    block.draggable = true;
                    block.addEventListener('dragstart', (e) => {
                        e.stopPropagation();
                        e.dataTransfer.effectAllowed = 'move';
                        e.dataTransfer.setData('text/plain', shift.id || shift._id);
                        block.classList.add('is-dragging');
                    });
                    block.addEventListener('dragend', () => {
                        block.classList.remove('is-dragging');
                    });

                    td.appendChild(block);
                }
            }

            if (!isVacationDay) {
                td.addEventListener('dragover', (e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                    td.classList.add('drag-over');
                });
                td.addEventListener('dragleave', () => {
                    td.classList.remove('drag-over');
                });
                td.addEventListener('drop', async (e) => {
                    e.preventDefault();
                    td.classList.remove('drag-over');
                    const draggedShiftId = e.dataTransfer.getData('text/plain');
                    if (!draggedShiftId) return;

                    const draggedShift = AppState.shifts.find(s => (s.id || s._id) === draggedShiftId);
                    if (!draggedShift) return;
                    if (draggedShift.employeeId === employee.id && draggedShift.date === dateString) return;

                    const targetHasShift = AppState.shifts.some(s => s.employeeId === employee.id && s.date === dateString && (s.id || s._id) !== draggedShiftId);
                    if (targetHasShift && !confirm("Un horaire existe déjà pour cet employé à cette date. Voulez-vous le remplacer ?")) {
                        return;
                    }

                    await AppState.moveShift(draggedShift, employee.id, dateString);
                    this.renderScheduleTable();
                    this.renderSummary();
                });
            }

            td.addEventListener('click', () => this.openModal(employee, dateString, shift));

            if (i < daysPerTable) tr1.appendChild(td);
            else tr2.appendChild(td);
        }
        this.elements.scheduleTbody1.appendChild(tr1);
        this.elements.scheduleTbody2.appendChild(tr2);
    });
}
});
