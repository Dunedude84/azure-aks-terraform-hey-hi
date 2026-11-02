Object.assign(AppUI, {
    openModal: function (employee, dateString, existingShift) {
        this.elements.modalEmployeeId.value = employee.id;
        this.elements.modalDate.value = dateString;

        const dateObj = AppUtils.parseLocalDate(dateString);
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        const formattedDate = dateObj.toLocaleDateString('fr-FR', options);

        this.elements.modalTitle.textContent = existingShift ? "Modifier l'horaire" : "Ajouter un horaire";
        this.elements.modalSubtitle.textContent = `${employee.name} - ${formattedDate}`;

        const isFormationEmployee = !!employee.isFormation;
        const modalIsFormation = document.getElementById('modal-is-formation');

        if (existingShift) {
            this.elements.modalStartTime.value = (existingShift.startTime || '09:00').padStart(5, '0');
            this.elements.modalEndTime.value = (existingShift.endTime || '17:00').padStart(5, '0');
            document.getElementById('modal-break-minutes').value = existingShift.breakMinutes || 0;
            modalIsFormation.checked = isFormationEmployee || (existingShift.isFormation || false);
            document.getElementById('modal-has-star').checked = existingShift.hasStar || false;
            this.elements.modalDeleteBtn.classList.remove('hidden');
            this.elements.shiftModal.dataset.shiftId = existingShift.id;
        } else {
            this.elements.modalStartTime.value = '09:00';
            this.elements.modalEndTime.value = '17:00';
            document.getElementById('modal-break-minutes').value = employee.lunchBreakMinutes || 0;
            modalIsFormation.checked = isFormationEmployee;
            document.getElementById('modal-has-star').checked = false;
            this.elements.modalDeleteBtn.classList.add('hidden');
            delete this.elements.shiftModal.dataset.shiftId;
        }

        modalIsFormation.disabled = isFormationEmployee;
        const modalIsFormationLabel = document.querySelector('label[for="modal-is-formation"]');
        modalIsFormation.style.opacity = isFormationEmployee ? '0.6' : '';
        if (modalIsFormationLabel) {
            modalIsFormationLabel.style.opacity = isFormationEmployee ? '0.6' : '';
            modalIsFormationLabel.style.cursor = isFormationEmployee ? 'not-allowed' : 'pointer';
        }

        this.elements.shiftModal.classList.remove('hidden');
        this.elements.modalStartTime.focus();
    },

    closeModal: function () {
        this.elements.shiftModal.classList.add('hidden');
    },

    openAvailabilityModal: function (employee) {
        // Always get fresh data from AppState in case it was updated since last render
        const freshEmployee = AppState.employees.find(e => e.id === employee.id) || employee;

        this.elements.availModalEmpId.value = freshEmployee.id;
        this.elements.availModalTitle.textContent = `Disponibilités - ${freshEmployee.name}`;

        const dayNames = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
        const monthNames = ['janv.', 'fév.', 'mars', 'avr.', 'mai', 'juin', 'juill.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
        const periodStart = AppUtils.getStartOfWeek(AppState.currentDate);
        const weekStart = AppUtils.formatDate(periodStart);
        const week2StartDate = new Date(periodStart);
        week2StartDate.setDate(week2StartDate.getDate() + 7);
        const week2Start = AppUtils.formatDate(week2StartDate);
        this.elements.availList.innerHTML = '';

        // --- Employee type section ---
        const empType = freshEmployee.employeeType || 'temps-plein';
        const empTarget = freshEmployee.weeklyHoursTarget || (empType === 'temps-partiel' ? 20 : 37.5);
        const headCashierDisabled = AppState.employees.some(e => e.id !== freshEmployee.id && e.isHeadCashier);
        const headCashierTitle = headCashierDisabled ? 'Un seul chef caissière peut être désigné.' : '';

        const typeSection = document.createElement('div');
        typeSection.style.cssText = 'display:flex; align-items:center; gap:16px; margin-bottom:16px; padding:12px; background:#f8fafc; border-radius:8px; flex-wrap: wrap;';
        typeSection.innerHTML = `
            <div style="flex:1.5; min-width: 140px;">
                <label style="font-weight:600; display:block; margin-bottom:4px;">Type d'employé</label>
                <select id="avail-emp-type" style="width:100%; padding:6px 10px; border:1px solid #cbd5e1; border-radius:6px; font-size:0.95rem;">
                    <option value="temps-plein"  ${empType === 'temps-plein' ? 'selected' : ''}>Temps plein</option>
                    <option value="temps-partiel" ${empType === 'temps-partiel' ? 'selected' : ''}>Temps partiel</option>
                </select>
            </div>
            <div style="flex:1.2; min-width: 120px;">
                <label style="font-weight:600; display:block; margin-bottom:4px;">Heures cibles / sem</label>
                <input type="number" id="avail-hours-target" value="${empTarget}" min="1" max="60" step="0.5"
                    style="width:100%; padding:6px 10px; border:1px solid #cbd5e1; border-radius:6px; font-size:0.95rem;">
            </div>
            <div style="flex:1; min-width: 110px;">
                <label style="font-weight:600; display:block; margin-bottom:4px;">Ancienneté (1=max)</label>
                <input type="number" id="avail-seniority" value="${freshEmployee.seniority !== undefined ? freshEmployee.seniority : 10}" min="1" max="99"
                    style="width:100%; padding:6px 10px; border:1px solid #cbd5e1; border-radius:6px; font-size:0.95rem;">
            </div>
            <div style="flex:1; min-width: 110px;">
                <label style="font-weight:600; display:block; margin-bottom:4px;">Pause repas (min)</label>
                <input type="number" id="avail-break-minutes" value="${freshEmployee.lunchBreakMinutes || 0}" min="0" step="15"
                    style="width:100%; padding:6px 10px; border:1px solid #cbd5e1; border-radius:6px; font-size:0.95rem;">
            </div>
            <div style="flex:1; min-width: 110px;">
                <label style="font-weight:600; display:block; margin-bottom:4px;">Max soirs / sem</label>
                <input type="number" id="avail-max-evening" value="${freshEmployee.maxEveningShifts !== undefined && freshEmployee.maxEveningShifts !== null ? freshEmployee.maxEveningShifts : ''}" placeholder="3"
                    style="width:100%; padding:6px 10px; border:1px solid #cbd5e1; border-radius:6px; font-size:0.95rem;">
            </div>
            <div style="flex:0.8; display:flex; align-items:flex-end; min-width: 110px; padding-bottom: 6px;">
                <label style="display:flex; align-items:center; gap:6px; cursor:pointer; font-weight:600; font-size:0.95rem;">
                    <input type="checkbox" id="avail-is-formation" ${freshEmployee.isFormation ? 'checked' : ''} style="width:16px; height:16px;">
                    En formation
                </label>
            </div>
            <div style="flex:0.8; display:flex; align-items:flex-end; min-width: 110px; padding-bottom: 6px;">
                <label style="display:flex; align-items:center; gap:6px; ${headCashierDisabled ? 'cursor:not-allowed; opacity:0.5;' : 'cursor:pointer;'} font-weight:600; font-size:0.95rem;" title="${headCashierTitle}">
                    <input type="checkbox" id="avail-is-head-cashier" ${freshEmployee.isHeadCashier ? 'checked' : ''} ${headCashierDisabled ? 'disabled' : ''} style="width:16px; height:16px;">
                    Chef caissière
                </label>
            </div>
        `;
        this.elements.availList.appendChild(typeSection);

        // --- Login credentials section (employee self-service access) ---
        const credsSection = document.createElement('div');
        credsSection.style.cssText = 'display:flex; align-items:flex-end; gap:16px; margin-bottom:16px; padding:12px; background:#eff6ff; border:1px solid #bfdbfe; border-radius:8px; flex-wrap: wrap;';
        credsSection.innerHTML = `
            <div style="flex:1; min-width: 160px;">
                <label style="font-weight:600; display:block; margin-bottom:4px;">Nom d'utilisateur</label>
                <input type="text" id="avail-username" value="${freshEmployee.username || ''}" placeholder="ex: jdupont"
                    style="width:100%; padding:6px 10px; border:1px solid #cbd5e1; border-radius:6px; font-size:0.95rem;">
            </div>
            <div style="flex:1; min-width: 160px;">
                <label style="font-weight:600; display:block; margin-bottom:4px;">Mot de passe</label>
                <input type="password" id="avail-password" placeholder="Laisser vide pour ne pas changer"
                    style="width:100%; padding:6px 10px; border:1px solid #cbd5e1; border-radius:6px; font-size:0.95rem;">
            </div>
            <div style="font-size:0.78rem; color:#1d4ed8; flex-basis:100%;">
                Ces identifiants permettent à l'employé de se connecter au portail simplifié pour gérer ses propres disponibilités.
            </div>
        `;
        this.elements.availList.appendChild(credsSection);

        // --- Vacations section ---
        const vacationsSection = document.createElement('div');
        vacationsSection.style.cssText = 'margin-bottom:16px; padding:12px; background:#fffbeb; border:1px solid #fef08a; border-radius:8px;';
        
        let vacationsHtml = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                <label style="font-weight:600; color:#854d0e; font-size:0.95rem;">Périodes de vacances</label>
                <button id="add-vacation-btn" class="btn-secondary" style="padding:4px 8px; font-size:0.8rem;">+ Ajouter</button>
            </div>
            <div id="vacations-container" style="display:flex; flex-direction:column; gap:8px;">
        `;
        
        const vacations = freshEmployee.vacations || [];
        if (vacations.length === 0) {
            vacationsHtml += `<div id="no-vacations-msg" style="font-size:0.85rem; color:#a1a1aa; font-style:italic;">Aucune vacance prévue</div>`;
        }
        
        vacationsHtml += `</div>`;
        vacationsSection.innerHTML = vacationsHtml;
        this.elements.availList.appendChild(vacationsSection);

        const vacationsContainer = vacationsSection.querySelector('#vacations-container');

        const renderVacationRow = (vac) => {
            const row = document.createElement('div');
            row.className = 'vacation-row';
            row.style.cssText = 'display:flex; gap:10px; align-items:center; background:#fff; padding:6px; border-radius:4px; border:1px solid #fef08a;';
            row.innerHTML = `
                <div style="flex:1;">
                    <label style="font-size:0.8rem; color:#854d0e; display:block; margin-bottom:2px;">Début</label>
                    <input type="date" class="vac-start" value="${vac.startDate || ''}" style="width:100%; padding:4px; border:1px solid #cbd5e1; border-radius:4px;">
                </div>
                <div style="flex:1;">
                    <label style="font-size:0.8rem; color:#854d0e; display:block; margin-bottom:2px;">Fin</label>
                    <input type="date" class="vac-end" value="${vac.endDate || ''}" style="width:100%; padding:4px; border:1px solid #cbd5e1; border-radius:4px;">
                </div>
                <div style="padding-top:16px;">
                    <button class="icon-btn btn-danger remove-vacation-btn" style="width: 24px; height: 24px; padding: 0;" title="Supprimer">✖</button>
                </div>
            `;
            
            row.querySelector('.remove-vacation-btn').addEventListener('click', () => {
                row.remove();
                if (vacationsContainer.querySelectorAll('.vacation-row').length === 0 && !vacationsContainer.querySelector('#no-vacations-msg')) {
                    vacationsContainer.innerHTML = `<div id="no-vacations-msg" style="font-size:0.85rem; color:#a1a1aa; font-style:italic;">Aucune vacance prévue</div>`;
                }
            });
            return row;
        };

        vacations.forEach(vac => {
            vacationsContainer.appendChild(renderVacationRow(vac));
        });

        vacationsSection.querySelector('#add-vacation-btn').addEventListener('click', () => {
            const msg = vacationsContainer.querySelector('#no-vacations-msg');
            if (msg) msg.remove();
            vacationsContainer.appendChild(renderVacationRow({}));
        });

        // Auto-update target when type changes
        const typeSelect = typeSection.querySelector('#avail-emp-type');
        const targetInput = typeSection.querySelector('#avail-hours-target');
        typeSelect.addEventListener('change', () => {
            targetInput.value = typeSelect.value === 'temps-partiel' ? 20 : 37.5;
        });

        // Separator
        const sep = document.createElement('hr');
        sep.style.cssText = 'border:none; border-top:1px solid #e2e8f0; margin-bottom:12px;';
        this.elements.availList.appendChild(sep);

        // Week selector
        const weekSelectorDiv = document.createElement('div');
        weekSelectorDiv.style.cssText = 'display:flex; justify-content:space-between; margin-bottom: 15px; align-items:center;';
        weekSelectorDiv.innerHTML = `
            <div>
                <button id="avail-tab-week1" class="btn-primary" style="border-radius: 4px 0 0 4px; margin-right: 0;">Semaine 1</button>
                <button id="avail-tab-week2" class="btn-secondary" style="border-radius: 0 4px 4px 0; margin-left: -4px;">Semaine 2</button>
            </div>
            <button id="avail-copy-w1-w2" class="btn-secondary" style="font-size: 0.85rem;">Copier S1 vers S2</button>
        `;
        this.elements.availList.appendChild(weekSelectorDiv);

        const week1Container = document.createElement('div');
        week1Container.id = 'avail-week1-container';

        const week2Container = document.createElement('div');
        week2Container.id = 'avail-week2-container';
        week2Container.style.display = 'none';

        this.elements.availList.appendChild(week1Container);
        this.elements.availList.appendChild(week2Container);

        const tab1 = weekSelectorDiv.querySelector('#avail-tab-week1');
        const tab2 = weekSelectorDiv.querySelector('#avail-tab-week2');
        tab1.addEventListener('click', () => {
            tab1.className = 'btn-primary';
            tab2.className = 'btn-secondary';
            week1Container.style.display = 'block';
            week2Container.style.display = 'none';
        });
        tab2.addEventListener('click', () => {
            tab2.className = 'btn-primary';
            tab1.className = 'btn-secondary';
            week2Container.style.display = 'block';
            week1Container.style.display = 'none';
        });

        const allAvailabilities = freshEmployee.availabilities || [];

        function findAvail(dow, weekKey, isWeek1) {
            // Nouveau format : weekStart = dimanche réel de cette semaine, dayOfWeek 0-6
            let avail = allAvailabilities.find(a => (a.weekStart || null) === weekKey && a.dayOfWeek === dow);
            if (avail) return avail;

            // Ancien format (legacy) : weekStart = début de la période de 2 semaines,
            // dayOfWeek 0-6 pour la semaine 1 et 7-13 pour la semaine 2.
            const legacyDayOfWeek = isWeek1 ? dow : dow + 7;
            avail = allAvailabilities.find(a => (a.weekStart || null) === weekStart && a.dayOfWeek === legacyDayOfWeek);
            if (avail) return avail;

            // Disponibilité générique (sans weekStart)
            avail = allAvailabilities.find(a => !a.weekStart && a.dayOfWeek === legacyDayOfWeek);
            if (!avail && !isWeek1) {
                avail = allAvailabilities.find(a => !a.weekStart && a.dayOfWeek === dow);
            }
            return avail;
        }

        // Build 14 days
        for (let index = 0; index < 14; index++) {
            const dayName = dayNames[index % 7];
            const d = new Date(periodStart);
            d.setDate(d.getDate() + index);
            const dateLabel = `${dayName} ${d.getDate()} ${monthNames[d.getMonth()]}`;
            const isWeek1 = index < 7;
            const dow = index % 7;
            const weekKey = isWeek1 ? weekStart : week2Start;
            let avail = findAvail(dow, weekKey, isWeek1);
            if (!avail) {
                avail = { isAvailable: true, startTime: '08:00', endTime: '17:00', isFixed: false };
            }

            const row = document.createElement('div');
            row.className = 'avail-row';
            row.style.display = 'flex';
            row.style.alignItems = 'center';
            row.style.gap = '10px';
            row.style.marginBottom = '10px';

            row.innerHTML = `
                <div style="flex: 1; font-weight: 500;">${dateLabel}</div>
                <div>
                    <input type="checkbox" id="avail-check-${index}" data-day="${index}" ${avail.isAvailable ? 'checked' : ''}>
                    <label for="avail-check-${index}">Disponible</label>
                    
                    <span style="margin-left: 10px;">
                        <input type="checkbox" id="avail-fixed-${index}" data-day="${index}" ${avail.isFixed ? 'checked' : ''} ${!avail.isAvailable ? 'disabled' : ''}>
                        <label for="avail-fixed-${index}">Fixe</label>
                    </span>
                </div>
                <div>
                    <input type="text" id="avail-start-${index}" value="${avail.startTime}" maxlength="5" style="width: 75px; text-align: center;" ${!avail.isAvailable ? 'disabled' : ''}>
                    à
                    <input type="text" id="avail-end-${index}" value="${avail.endTime}" maxlength="5" style="width: 75px; text-align: center;" ${!avail.isAvailable ? 'disabled' : ''}>
                </div>
            `;

            if (index < 7) {
                week1Container.appendChild(row);
            } else {
                week2Container.appendChild(row);
            }

            // Toggle disable/enable time inputs and fixed checkbox
            const checkbox = row.querySelector(`#avail-check-${index}`);
            const fixedCheckbox = row.querySelector(`#avail-fixed-${index}`);
            const startInput = row.querySelector(`#avail-start-${index}`);
            const endInput = row.querySelector(`#avail-end-${index}`);

            startInput.dataset.lastValid = avail.startTime;
            endInput.dataset.lastValid = avail.endTime;

            checkbox.addEventListener('change', (e) => {
                startInput.disabled = !e.target.checked;
                endInput.disabled = !e.target.checked;
                fixedCheckbox.disabled = !e.target.checked;
                if (!e.target.checked) fixedCheckbox.checked = false;
            });
            startInput.addEventListener('input', AppUtils.formatTimeInput);
            endInput.addEventListener('input', AppUtils.formatTimeInput);
            startInput.addEventListener('blur', () => AppUtils.enforceTimeBounds(startInput, dow));
            endInput.addEventListener('blur', () => AppUtils.enforceTimeBounds(endInput, dow));
        }

        const copyBtn = weekSelectorDiv.querySelector('#avail-copy-w1-w2');
        copyBtn.addEventListener('click', () => {
            if (confirm("Voulez-vous copier les disponibilités de la Semaine 1 vers la Semaine 2 ?")) {
                for (let i = 0; i < 7; i++) {
                    const check1 = document.getElementById(`avail-check-${i}`);
                    const check2 = document.getElementById(`avail-check-${i + 7}`);
                    const fixed1 = document.getElementById(`avail-fixed-${i}`);
                    const fixed2 = document.getElementById(`avail-fixed-${i + 7}`);
                    const start1 = document.getElementById(`avail-start-${i}`);
                    const start2 = document.getElementById(`avail-start-${i + 7}`);
                    const end1 = document.getElementById(`avail-end-${i}`);
                    const end2 = document.getElementById(`avail-end-${i + 7}`);

                    check2.checked = check1.checked;
                    fixed2.checked = fixed1.checked;
                    fixed2.disabled = fixed1.disabled;
                    start2.value = start1.value;
                    start2.disabled = start1.disabled;
                    end2.value = end1.value;
                    end2.disabled = end1.disabled;
                }
                alert("Disponibilités copiées.");
            }
        });

        this.elements.availModal.classList.remove('hidden');
    },

    closeAvailabilityModal: function () {
        this.elements.availModal.classList.add('hidden');
    },

    openEmployeeActionModal: function (employee, startStr, endStr) {
        this.elements.empActionModalId.value = employee.id;
        this.elements.empActionModalStart.value = startStr;
        this.elements.empActionModalEnd.value = endStr;
        this.elements.empActionModalTitle.textContent = `Gérer - ${employee.name}`;
        this.elements.empActionModalSubtitle.textContent = `Sélectionnez les semaines à effacer :`;

        // Calculate weeks for display
        const [year, month, day] = startStr.split('-').map(Number);
        const w1Start = new Date(year, month - 1, day);
        const w1End = new Date(w1Start); w1End.setDate(w1Start.getDate() + 6);
        const w2Start = new Date(w1Start); w2Start.setDate(w1Start.getDate() + 7);
        const w2End = new Date(w2Start); w2End.setDate(w2Start.getDate() + 6);

        const monthNames = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];
        const fmtDisplay = d => `${d.getDate()} ${monthNames[d.getMonth()]}`;

        document.getElementById('emp-action-week-1-label').textContent = `Semaine 1 (Du ${fmtDisplay(w1Start)} au ${fmtDisplay(w1End)})`;
        document.getElementById('emp-action-week-2-label').textContent = `Semaine 2 (Du ${fmtDisplay(w2Start)} au ${fmtDisplay(w2End)})`;

        this.elements.empActionModal.classList.remove('hidden');
    },

    closeEmployeeActionModal: function () {
        this.elements.empActionModal.classList.add('hidden');
    },

    updateGenerateRuleDayOptions: function () {
        const weekSelect = document.getElementById('gen-rule-week');
        const daySelect = document.getElementById('gen-rule-day');
        if (!weekSelect || !daySelect) return;

        const periodStart = AppUtils.getStartOfWeek(AppState.currentDate);
        const selectedWeekOffset = parseInt(weekSelect.value, 10) || 0;
        const weekStart = new Date(periodStart);
        weekStart.setDate(periodStart.getDate() + selectedWeekOffset * 7);

        const dayNames = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
        const monthNames = ['janv.', 'fév.', 'mars', 'avr.', 'mai', 'juin', 'juill.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

        Array.from(daySelect.options).forEach((option) => {
            const dow = parseInt(option.value, 10);
            const dateObj = new Date(weekStart);
            dateObj.setDate(weekStart.getDate() + dow);
            option.textContent = `${dayNames[dow]} (${dateObj.getDate()} ${monthNames[dateObj.getMonth()]})`;
        });
    },

    getGenerateRuleWeekStart: function (weekOffset) {
        const periodStart = AppUtils.getStartOfWeek(AppState.currentDate);
        const weekStart = new Date(periodStart);
        weekStart.setDate(periodStart.getDate() + (weekOffset * 7));
        return AppUtils.formatDate(weekStart);
    },

    normalizeRuleWeekStart: function (weekStart) {
        return weekStart === undefined || weekStart === null || weekStart === '' ? null : weekStart;
    },

    findGenerateRuleExact: function (dayOfWeek, weekStart) {
        return AppState.shiftRules.find(r => (
            r.dayOfWeek === dayOfWeek &&
            this.normalizeRuleWeekStart(r.weekStart) === weekStart
        ));
    },

    getGenerateRuleForContext: function (dayOfWeek, weekStart) {
        const exact = this.findGenerateRuleExact(dayOfWeek, weekStart);
        if (exact) return exact;

        const generic = AppState.shiftRules.find(r => (
            r.dayOfWeek === dayOfWeek &&
            this.normalizeRuleWeekStart(r.weekStart) === null
        ));
        if (generic) return generic;

        return { dayOfWeek, weekStart, isOpen: true, requiredShifts: [] };
    },

    openGenerateModal: function () {
        const periodStart = AppUtils.getStartOfWeek(AppState.currentDate);
        const week1End = new Date(periodStart); week1End.setDate(periodStart.getDate() + 6);
        const week2Start = new Date(periodStart); week2Start.setDate(periodStart.getDate() + 7);
        const week2End = new Date(periodStart); week2End.setDate(periodStart.getDate() + 13);

        const monthNames = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];
        const fmt = d => `${d.getDate()} ${monthNames[d.getMonth()]}`;

        document.getElementById('gen-week-1-label').textContent = `Semaine 1 (${fmt(periodStart)} - ${fmt(week1End)})`;
        document.getElementById('gen-week-2-label').textContent = `Semaine 2 (${fmt(week2Start)} - ${fmt(week2End)})`;

        // Default to weeks tab
        document.getElementById('gen-tab-weeks').className = 'btn-primary';
        document.getElementById('gen-tab-rules').className = 'btn-secondary';
        document.getElementById('gen-section-weeks').style.display = 'block';
        document.getElementById('gen-section-rules').style.display = 'none';
        
        // Setup initial rule context (semaine 1, dimanche)
        document.getElementById('gen-rule-week').value = '0';
        document.getElementById('gen-rule-day').value = '0';
        this.updateGenerateRuleDayOptions();
        this.renderRuleShifts(0);

        document.getElementById('generate-modal').classList.remove('hidden');
    },

    renderRuleShifts: function(dayOfWeek) {
        const weekSelect = document.getElementById('gen-rule-week');
        const weekOffset = weekSelect ? (parseInt(weekSelect.value, 10) || 0) : 0;
        const weekStart = this.getGenerateRuleWeekStart(weekOffset);
        let rule = this.getGenerateRuleForContext(parseInt(dayOfWeek, 10), weekStart);
        const container = document.getElementById('gen-rule-shifts-container');
        
        container.innerHTML = '';

        if (!rule.requiredShifts || rule.requiredShifts.length === 0) {
            container.innerHTML = '<p class="text-muted" style="text-align:center; font-style:italic;">Aucun quart requis défini.</p>';
            return;
        }

        rule.requiredShifts.forEach((shift, index) => {
            const shiftDiv = document.createElement('div');
            shiftDiv.style.cssText = 'display:flex; align-items:center; gap:8px; background:var(--bg-secondary); padding:10px; border-radius:6px; flex-wrap:wrap;';
            
            shiftDiv.innerHTML = `
                <div style="display:flex; align-items:center; gap:6px;">
                    De <input type="text" class="rule-start" value="${shift.startTime}" maxlength="5" style="width: 60px; text-align: center; padding: 4px;">
                    à <input type="text" class="rule-end" value="${shift.endTime}" maxlength="5" style="width: 60px; text-align: center; padding: 4px;">
                </div>
                <div style="display:flex; align-items:center; gap:6px; margin-left:10px;">
                    Besoin: <input type="number" class="rule-count" value="${shift.count}" min="1" max="10" style="width: 50px; text-align: center; padding: 4px;"> emp.
                </div>
                <div style="flex:1; text-align:right;">
                    <button class="icon-btn btn-danger delete-rule-shift" data-index="${index}" style="width: 28px; height: 28px; padding: 0;">✖</button>
                </div>
            `;
            
            container.appendChild(shiftDiv);
            
            // Format time inputs
            const timeInputs = shiftDiv.querySelectorAll('input[type="text"]');
            timeInputs.forEach(input => input.addEventListener('input', AppUtils.formatTimeInput));
            
            // Delete shift
            const delBtn = shiftDiv.querySelector('.delete-rule-shift');
            delBtn.addEventListener('click', () => {
                shiftDiv.remove();
            });
        });
    }
});
