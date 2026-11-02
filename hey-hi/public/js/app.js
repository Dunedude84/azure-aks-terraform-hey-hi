const App = {
    init: async function () {
        AppUI.init();
        await AppState.checkSession();
        if (AppState.isGuest) {
            const banner = document.getElementById('guest-banner');
            if (banner) banner.classList.remove('hidden');
        }
        await AppState.loadData();
        AppUI.renderApp();
        this.setupEventListeners();
    },

    setupEventListeners: function () {
        // Department selection
        const departmentSelect = document.getElementById('department-select');
        departmentSelect.value = AppState.currentDepartment;
        departmentSelect.addEventListener('change', async (e) => {
            AppState.currentDepartment = e.target.value;
            localStorage.setItem('currentDepartment', AppState.currentDepartment);
            await AppState.loadData();
            AppUI.renderApp();
        });

        // Navigation Période
        document.getElementById('prev-month').addEventListener('click', () => {
            AppState.currentDate.setDate(AppState.currentDate.getDate() - 14);
            AppUI.renderApp();
        });

        document.getElementById('next-month').addEventListener('click', () => {
            AppState.currentDate.setDate(AppState.currentDate.getDate() + 14);
            AppUI.renderApp();
        });

        // Bottom Navigation Période
        document.getElementById('prev-month-bottom').addEventListener('click', () => {
            AppState.currentDate.setDate(AppState.currentDate.getDate() - 14);
            AppUI.renderApp();
        });

        document.getElementById('next-month-bottom').addEventListener('click', () => {
            AppState.currentDate.setDate(AppState.currentDate.getDate() + 14);
            AppUI.renderApp();
        });

        document.getElementById('summary-week-filter').addEventListener('change', (e) => {
            AppState.summaryWeekFilter = e.target.value;
            AppUI.renderSummary();
        });

        document.getElementById('logout-btn').addEventListener('click', async () => {
            try {
                await fetch('/api/auth/logout', { method: 'POST' });
            } finally {
                window.location.href = '/login.html';
            }
        });

        // Actions dropdown menu
        const actionsMenuBtn = document.getElementById('actions-menu-btn');
        const actionsMenu = document.getElementById('actions-menu');

        actionsMenuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            actionsMenu.classList.toggle('hidden');
        });

        actionsMenu.addEventListener('click', (e) => {
            if (e.target.tagName === 'BUTTON') {
                actionsMenu.classList.add('hidden');
            }
        });

        document.addEventListener('click', (e) => {
            if (!actionsMenu.classList.contains('hidden') && !actionsMenu.contains(e.target) && e.target !== actionsMenuBtn) {
                actionsMenu.classList.add('hidden');
            }
        });

        document.getElementById('generate-schedule-btn').addEventListener('click', () => {
            AppUI.openGenerateModal();
        });

        // Print Modal
        const printModal = document.getElementById('print-modal');

        const MOIS_FR = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];

        const fmtFrench = (start, end) => {
            const sm = start.getMonth();
            const em = end.getMonth();
            if (sm === em) {
                return `du ${start.getDate()} au ${end.getDate()} ${MOIS_FR[em]}`;
            } else {
                return `du ${start.getDate()} ${MOIS_FR[sm]} au ${end.getDate()} ${MOIS_FR[em]}`;
            }
        };

        const fmtDate = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

        // Génère les semaines dans le modal d'impression (2 passées + 2 courantes + 4 futures)
        const buildPrintWeeksList = (containerId = 'print-weeks-container', cbClassName = 'print-week-cb') => {
            const container = document.getElementById(containerId);
            container.innerHTML = '';

            const periodStart = AppUtils.getStartOfWeek(AppState.currentDate);
            const dayNames = ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam'];

            // 2 semaines passées + 2 semaines courantes + 4 semaines futures = 8 semaines
            const WEEKS_BEFORE = 2;
            const WEEKS_AFTER = 5; // +2 courantes +4 futures → index -2 à +5
            const totalWeeks = WEEKS_BEFORE + 1 + WEEKS_AFTER; // 8 semaines

            for (let i = -WEEKS_BEFORE; i <= WEEKS_AFTER; i++) {
                const wStart = new Date(periodStart);
                wStart.setDate(periodStart.getDate() + i * 7);
                const wEnd = new Date(wStart);
                wEnd.setDate(wStart.getDate() + 6);

                const weekLabel = fmtFrench(wStart, wEnd);
                const wStartStr = fmtDate(wStart);

                const isCurrent = (i === 0 || i === 1); // Les 2 semaines actuellement affichées
                const isPast = wEnd < new Date();

                const label = document.createElement('label');
                label.style.cssText = `display: flex; align-items: center; gap: 10px; cursor: pointer; padding: 10px 14px; border: 1px solid var(--border-color); border-radius: 8px; transition: background 0.15s; ${isPast ? 'opacity: 0.7;' : ''}`;
                label.dataset.weekStart = wStartStr;

                const cb = document.createElement('input');
                cb.type = 'checkbox';
                cb.className = cbClassName;
                cb.dataset.weekStart = wStartStr;
                cb.style.cssText = 'width: 18px; height: 18px; cursor: pointer; flex-shrink: 0;';
                cb.checked = isCurrent; // Cocher les 2 semaines courantes par défaut

                const info = document.createElement('div');
                info.style.cssText = 'flex: 1;';

                const numLabel = document.createElement('div');
                numLabel.style.cssText = 'font-weight: 600; font-size: 0.8rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.04em;';
                numLabel.textContent = isPast ? '📅 Passée' : (isCurrent ? '📌 En cours' : '🗓 À venir');

                const dateLabel = document.createElement('div');
                dateLabel.style.cssText = 'font-weight: 500; color: var(--text-main);';
                dateLabel.textContent = weekLabel;

                info.appendChild(numLabel);
                info.appendChild(dateLabel);
                label.appendChild(cb);
                label.appendChild(info);

                // Highlight active weeks
                if (isCurrent) {
                    label.style.borderColor = 'var(--primary-color)';
                    label.style.background = 'var(--primary-light)';
                }

                cb.addEventListener('change', () => {
                    if (cb.checked) {
                        label.style.borderColor = 'var(--primary-color)';
                        label.style.background = 'var(--primary-light)';
                    } else {
                        label.style.borderColor = 'var(--border-color)';
                        label.style.background = '';
                    }
                });

                container.appendChild(label);
            }
        };

        // Construit une table HTML pour une semaine donnée
        const buildWeekTable = (weekStartDate) => {
            const dayNames = ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam'];
            const shiftMap = {};
            AppState.shifts.forEach(shift => {
                if (!shiftMap[shift.employeeId]) shiftMap[shift.employeeId] = {};
                shiftMap[shift.employeeId][shift.date] = shift;
            });

            const table = document.createElement('table');
            table.className = 'schedule-table';
            table.style.cssText = 'width: 100%; border-collapse: collapse;';

            // En-tête
            const thead = document.createElement('thead');
            const trHead = document.createElement('tr');
            trHead.innerHTML = '<th>Employé</th>';
            for (let i = 0; i < 7; i++) {
                const d = new Date(weekStartDate);
                d.setDate(weekStartDate.getDate() + i);
                const th = document.createElement('th');
                if (d.getDay() === 0 || d.getDay() === 6) th.style.color = 'var(--danger-color)';
                th.innerHTML = `${dayNames[d.getDay()]}<br>${d.getDate()}`;
                trHead.appendChild(th);
            }
            thead.appendChild(trHead);
            table.appendChild(thead);

            // Corps
            const tbody = document.createElement('tbody');
            AppState.employees.forEach(emp => {
                const tr = document.createElement('tr');
                const nameTd = document.createElement('td');
                nameTd.className = 'employee-cell';
                nameTd.innerHTML = `<span>${emp.name}</span>`;
                tr.appendChild(nameTd);

                for (let i = 0; i < 7; i++) {
                    const dateObj = new Date(weekStartDate);
                    dateObj.setDate(weekStartDate.getDate() + i);
                    
                    const y = dateObj.getFullYear();
                    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
                    const d = String(dateObj.getDate()).padStart(2, '0');
                    const dateString = `${y}-${m}-${d}`;
                    
                    const td = document.createElement('td');
                    td.className = 'shift-cell';
                    if (dateObj.getDay() === 0 || dateObj.getDay() === 6) td.classList.add('is-weekend');

                    const isVacationDay = (emp.vacations || []).some(vac => dateString >= vac.startDate && dateString <= vac.endDate);

                    const shift = shiftMap[emp.id] && shiftMap[emp.id][dateString];

                    if (isVacationDay) {
                        td.innerHTML = `<div class="shift-block" style="background:#fef08a; color:#854d0e; border:1px solid #fde047; justify-content:center;"><span style="font-weight:600;">Vacances</span></div>`;
                    } else if (shift && shift.code) {
                        const label = shift.code === 'CONGÉ' ? 'Congé' : shift.code;
                        td.innerHTML = `<div class="shift-block" style="background:#fef08a; color:#854d0e; border:1px solid #fde047; justify-content:center;"><span style="font-weight:600;">${label}</span></div>`;
                    } else {
                        if (shift) {
                            const block = document.createElement('div');
                            block.className = 'shift-block';
                            if (shift.isFormation) block.classList.add('is-formation');
                            const compactTime = (t, suffix = '') => {
                                const [h, m] = t.split(':');
                                const hh = parseInt(h, 10);
                                return m === '00' ? `${hh}${suffix}` : `${hh}h${m}${suffix}`;
                            };
                            const startDisplay = compactTime(shift.startTime);
                            let endDisplay = compactTime(shift.endTime, 'h');
                            if (shift.hasStar) endDisplay += '<b style="font-size:1rem;color:#dc2626;margin-left:2px;">*</b>';
                            if (shift.isFormation) {
                                block.innerHTML = `<span>${startDisplay}-${endDisplay}</span> <b style="font-size:0.75rem;color:#7e22ce;">F</b>`;
                            } else {
                                block.innerHTML = `<span>${startDisplay}-${endDisplay}</span>`;
                            }
                            td.appendChild(block);
                        }
                    }
                    tr.appendChild(td);
                }
                tbody.appendChild(tr);
            });
            table.appendChild(tbody);
            return table;
        };

        document.getElementById('print-btn').addEventListener('click', () => {
            buildPrintWeeksList();
            printModal.classList.remove('hidden');
        });

        const closePrintModal = () => printModal.classList.add('hidden');
        document.getElementById('close-print-modal').addEventListener('click', closePrintModal);
        document.getElementById('cancel-print-btn').addEventListener('click', closePrintModal);

        document.getElementById('confirm-print-btn').addEventListener('click', () => {
            const checkedAll = [...document.querySelectorAll('.print-week-cb:checked')];
            if (checkedAll.length === 0) {
                alert("Veuillez sélectionner au moins une semaine à imprimer.");
                return;
            }
            // Keep only first two weeks if more selected
            const checked = checkedAll.slice(0, 2);
            if (checkedAll.length > 2) {
                alert('Seules les deux premières semaines sélectionnées seront imprimées.');
            }

            const departmentSelect = document.getElementById('department-select');
            const departmentName = departmentSelect.options[departmentSelect.selectedIndex].text;

            // Build hidden print area
            const printArea = document.getElementById('print-area');
            printArea.innerHTML = '';

            const weekStarts = checked.map(cb => {
                const [y, m, d] = cb.dataset.weekStart.split('-').map(Number);
                return new Date(y, m - 1, d);
            });

            // Sort weeks
            weekStarts.sort((a, b) => a - b);

            // Global header spanning both weeks
            const firstStart = weekStarts[0];
            const lastEnd = new Date(weekStarts[weekStarts.length - 1]);
            lastEnd.setDate(lastEnd.getDate() + 6);
            const dateRange = fmtFrench(firstStart, lastEnd);
            const header = document.createElement('div');
            header.className = 'print-main-header';
            header.textContent = `Horaire - ${departmentName} - ${dateRange}`;
            printArea.appendChild(header);

            // Wrapper for side‑by‑side weeks
            const wrapper = document.createElement('div');
            wrapper.className = 'print-week-wrapper';
            printArea.appendChild(wrapper);

            weekStarts.forEach((wStart) => {
                const wEnd = new Date(wStart);
                wEnd.setDate(wStart.getDate() + 6);

                const weekBlock = document.createElement('div');
                weekBlock.className = 'print-week-block';

                const weekHeader = document.createElement('div');
                weekHeader.className = 'print-week-header';
                weekHeader.textContent = fmtFrench(wStart, wEnd);
                weekBlock.appendChild(weekHeader);

                const tbl = buildWeekTable(wStart);
                tbl.classList.add('print-week-table');
                weekBlock.appendChild(tbl);
                wrapper.appendChild(weekBlock);
            });

            // Switch to custom print mode
            document.body.setAttribute('data-custom-print', 'true');
            closePrintModal();
            window.print();
            // Cleanup after print
            setTimeout(() => {
                document.body.removeAttribute('data-custom-print');
                printArea.innerHTML = '';
            }, 1000);
        });

        // Availability Report Modal
        const availReportModal = document.getElementById('avail-report-modal');

        // Cherche la disponibilité d'un employé pour un jour donné (format actuel + repli générique)
        const findEmployeeAvailability = (emp, weekKeyStr, dow) => {
            const all = emp.availabilities || [];
            let avail = all.find(a => (a.weekStart || null) === weekKeyStr && a.dayOfWeek === dow);
            if (avail) return avail;
            avail = all.find(a => !a.weekStart && a.dayOfWeek === dow);
            if (avail) return avail;
            return { isAvailable: true, startTime: '08:00', endTime: '17:00', isFixed: false };
        };

        const buildAvailabilityWeekTable = (weekStartDate) => {
            const dayNames = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
            const weekKeyStr = fmtDate(weekStartDate);

            const table = document.createElement('table');
            table.className = 'schedule-table';
            table.style.cssText = 'width: 100%; border-collapse: collapse;';

            const thead = document.createElement('thead');
            const trHead = document.createElement('tr');
            trHead.innerHTML = '<th>Employé</th>';
            for (let i = 0; i < 7; i++) {
                const d = new Date(weekStartDate);
                d.setDate(weekStartDate.getDate() + i);
                const th = document.createElement('th');
                if (d.getDay() === 0 || d.getDay() === 6) th.style.color = 'var(--danger-color)';
                th.innerHTML = `${dayNames[d.getDay()]}<br>${d.getDate()}`;
                trHead.appendChild(th);
            }
            thead.appendChild(trHead);
            table.appendChild(thead);

            const tbody = document.createElement('tbody');
            AppState.employees.forEach(emp => {
                const tr = document.createElement('tr');
                const nameTd = document.createElement('td');
                nameTd.className = 'employee-cell';
                nameTd.innerHTML = `<span>${emp.name}</span>`;
                tr.appendChild(nameTd);

                for (let i = 0; i < 7; i++) {
                    const dateObj = new Date(weekStartDate);
                    dateObj.setDate(weekStartDate.getDate() + i);
                    const dateString = fmtDate(dateObj);

                    const td = document.createElement('td');
                    td.className = 'shift-cell';
                    if (dateObj.getDay() === 0 || dateObj.getDay() === 6) td.classList.add('is-weekend');

                    const isVacationDay = (emp.vacations || []).some(vac => dateString >= vac.startDate && dateString <= vac.endDate);

                    if (isVacationDay) {
                        td.innerHTML = `<div class="shift-block" style="background:#fef08a; color:#854d0e; border:1px solid #fde047; justify-content:center;"><span style="font-weight:600;">Vacances</span></div>`;
                    } else {
                        const avail = findEmployeeAvailability(emp, weekKeyStr, i);
                        const block = document.createElement('div');
                        block.className = 'shift-block';
                        if (avail.isAvailable) {
                            block.style.cssText = 'background:#dcfce7; color:#166534; border:1px solid #86efac; justify-content:center;';
                            const fixedTag = avail.isFixed ? ' <b style="font-size:0.7rem;">(Fixe)</b>' : '';
                            block.innerHTML = `<span>${avail.startTime}-${avail.endTime}</span>${fixedTag}`;
                        } else {
                            block.style.cssText = 'background:#fee2e2; color:#991b1b; border:1px solid #fca5a5; justify-content:center;';
                            block.innerHTML = `<span>Indisponible</span>`;
                        }
                        td.appendChild(block);
                    }
                    tr.appendChild(td);
                }
                tbody.appendChild(tr);
            });
            table.appendChild(tbody);
            return table;
        };

        document.getElementById('availability-report-btn').addEventListener('click', () => {
            buildPrintWeeksList('avail-report-weeks-container', 'avail-report-week-cb');
            availReportModal.classList.remove('hidden');
        });

        const closeAvailReportModal = () => availReportModal.classList.add('hidden');
        document.getElementById('close-avail-report-modal').addEventListener('click', closeAvailReportModal);
        document.getElementById('cancel-avail-report-btn').addEventListener('click', closeAvailReportModal);

        document.getElementById('confirm-avail-report-btn').addEventListener('click', () => {
            const checkedAll = [...document.querySelectorAll('.avail-report-week-cb:checked')];
            if (checkedAll.length === 0) {
                alert("Veuillez sélectionner au moins une semaine pour le rapport.");
                return;
            }

            const departmentSelect = document.getElementById('department-select');
            const departmentName = departmentSelect.options[departmentSelect.selectedIndex].text;

            const printArea = document.getElementById('print-area');
            printArea.innerHTML = '';

            const weekStarts = checkedAll.map(cb => {
                const [y, m, d] = cb.dataset.weekStart.split('-').map(Number);
                return new Date(y, m - 1, d);
            }).sort((a, b) => a - b);

            const firstStart = weekStarts[0];
            const lastEnd = new Date(weekStarts[weekStarts.length - 1]);
            lastEnd.setDate(lastEnd.getDate() + 6);
            const dateRange = fmtFrench(firstStart, lastEnd);
            const header = document.createElement('div');
            header.className = 'print-main-header';
            header.textContent = `Rapport de disponibilités - ${departmentName} - ${dateRange}`;
            printArea.appendChild(header);

            const wrapper = document.createElement('div');
            wrapper.className = 'print-week-wrapper';
            printArea.appendChild(wrapper);

            weekStarts.forEach((wStart) => {
                const wEnd = new Date(wStart);
                wEnd.setDate(wStart.getDate() + 6);

                const weekBlock = document.createElement('div');
                weekBlock.className = 'print-week-block';

                const weekHeader = document.createElement('div');
                weekHeader.className = 'print-week-header';
                weekHeader.textContent = fmtFrench(wStart, wEnd);
                weekBlock.appendChild(weekHeader);

                const tbl = buildAvailabilityWeekTable(wStart);
                tbl.classList.add('print-week-table');
                weekBlock.appendChild(tbl);
                wrapper.appendChild(weekBlock);
            });

            document.body.setAttribute('data-custom-print', 'true');
            closeAvailReportModal();
            window.print();
            setTimeout(() => {
                document.body.removeAttribute('data-custom-print');
                printArea.innerHTML = '';
            }, 1000);
        });

        const deleteScheduleModal = document.getElementById('delete-schedule-modal');

        document.getElementById('delete-schedule-btn').addEventListener('click', () => {
            // Update labels with the actual dates for clarity
            const periodStart = AppUtils.getStartOfWeek(AppState.currentDate);
            const w1Start = new Date(periodStart);
            const w1End = new Date(w1Start);
            w1End.setDate(w1Start.getDate() + 6);
            
            const w2Start = new Date(w1Start);
            w2Start.setDate(w1Start.getDate() + 7);
            const w2End = new Date(w2Start);
            w2End.setDate(w2Start.getDate() + 6);

            const fmtDisplay = d => `${d.getDate()}/${d.getMonth()+1}`;
            
            document.getElementById('del-week-1-label').textContent = `Semaine 1 (${fmtDisplay(w1Start)} - ${fmtDisplay(w1End)})`;
            document.getElementById('del-week-2-label').textContent = `Semaine 2 (${fmtDisplay(w2Start)} - ${fmtDisplay(w2End)})`;
            
            deleteScheduleModal.classList.remove('hidden');
        });

        const closeDeleteModal = () => deleteScheduleModal.classList.add('hidden');
        document.getElementById('close-delete-schedule-modal').addEventListener('click', closeDeleteModal);
        document.getElementById('cancel-delete-schedule-btn').addEventListener('click', closeDeleteModal);

        document.getElementById('confirm-delete-schedule-btn').addEventListener('click', async () => {
            const deleteW1 = document.getElementById('del-week-1').checked;
            const deleteW2 = document.getElementById('del-week-2').checked;

            if (!deleteW1 && !deleteW2) {
                alert("Veuillez sélectionner au moins une semaine à supprimer.");
                return;
            }

            const periodStart = AppUtils.getStartOfWeek(AppState.currentDate);
            const fmt = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

            try {
                if (deleteW1) {
                    const w1End = new Date(periodStart);
                    w1End.setDate(periodStart.getDate() + 6);
                    await AppState.deleteScheduleRange(fmt(periodStart), fmt(w1End));
                }
                
                if (deleteW2) {
                    const w2Start = new Date(periodStart);
                    w2Start.setDate(periodStart.getDate() + 7);
                    const w2End = new Date(w2Start);
                    w2End.setDate(w2Start.getDate() + 6);
                    await AppState.deleteScheduleRange(fmt(w2Start), fmt(w2End));
                }

                closeDeleteModal();
                AppUI.renderApp();
                alert("Horaire supprimé avec succès.");
            } catch (err) {
                alert('Erreur : ' + err.message);
            }
        });

        // Gestion Employés
        const addEmployeeBtn = document.getElementById('add-employee');
        const employeeNameInput = document.getElementById('employee-name');

        addEmployeeBtn.addEventListener('click', async () => {
            const name = employeeNameInput.value.trim();
            if (name) {
                await AppState.addEmployee(name);
                employeeNameInput.value = '';
                AppUI.renderApp();
            }
        });

        employeeNameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') addEmployeeBtn.click();
        });

        // Modale Horaires
        const closeModalBtn = document.getElementById('close-modal');
        const modalSaveBtn = document.getElementById('modal-save-btn');
        const modalDeleteBtn = document.getElementById('modal-delete-btn');
        const shiftModal = document.getElementById('shift-modal');
        const modalStartTime = document.getElementById('modal-start-time');
        const modalEndTime = document.getElementById('modal-end-time');

        closeModalBtn.addEventListener('click', () => AppUI.closeModal());

        modalSaveBtn.addEventListener('click', async () => {
            const startTime = AppUtils.normalizeTime(modalStartTime.value);
            const endTime = AppUtils.normalizeTime(modalEndTime.value);

            if (!startTime || !endTime) {
                alert("Veuillez saisir une heure valide au format 24h (ex: 08:30 ou 14:00).");
                return;
            }
            if (AppUtils.timeToMinutes(startTime) >= AppUtils.timeToMinutes(endTime)) {
                alert("L'heure de début doit être avant l'heure de fin.");
                return;
            }

            modalStartTime.value = startTime;
            modalEndTime.value = endTime;

            await AppState.saveShift({
                employeeId: document.getElementById('modal-employee-id').value,
                date: document.getElementById('modal-date').value,
                startTime: startTime,
                endTime: endTime,
                breakMinutes: parseInt(document.getElementById('modal-break-minutes').value) || 0,
                isFormation: document.getElementById('modal-is-formation').checked,
                hasStar: document.getElementById('modal-has-star').checked
            }, shiftModal.dataset.shiftId);

            AppUI.closeModal();
            AppUI.renderScheduleTable();
            AppUI.renderSummary();
        });

        modalDeleteBtn.addEventListener('click', async () => {
            const shiftId = shiftModal.dataset.shiftId;
            if (shiftId) {
                await AppState.deleteShift(shiftId);
                AppUI.closeModal();
                AppUI.renderScheduleTable();
                AppUI.renderSummary();
            }
        });

        modalStartTime.addEventListener('input', AppUtils.formatTimeInput);
        modalEndTime.addEventListener('input', AppUtils.formatTimeInput);
        modalStartTime.addEventListener('blur', () => {
            const normalized = AppUtils.normalizeTime(modalStartTime.value);
            if (normalized) modalStartTime.value = normalized;
        });
        modalEndTime.addEventListener('blur', () => {
            const normalized = AppUtils.normalizeTime(modalEndTime.value);
            if (normalized) modalEndTime.value = normalized;
        });



        // Modale Disponibilités
        const closeAvailModalBtn = document.getElementById('close-avail-modal');
        const availModalSaveBtn = document.getElementById('avail-modal-save-btn');
        const availModal = document.getElementById('availability-modal');

        closeAvailModalBtn.addEventListener('click', () => AppUI.closeAvailabilityModal());



        availModalSaveBtn.addEventListener('click', async () => {
            const empId = document.getElementById('avail-modal-employee-id').value;
            const periodStart = AppUtils.getStartOfWeek(AppState.currentDate);
            const weekStart = AppUtils.formatDate(periodStart);
            const week2StartDate = new Date(periodStart);
            week2StartDate.setDate(week2StartDate.getDate() + 7);
            const week2Start = AppUtils.formatDate(week2StartDate);
            const availabilities = [];

            const dayNamesFr = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];

            for (let i = 0; i < 14; i++) {
                const dow = i % 7;
                const isAvail = document.getElementById(`avail-check-${i}`).checked;
                const isFixed = document.getElementById(`avail-fixed-${i}`).checked;
                const startInput = document.getElementById(`avail-start-${i}`);
                const endInput = document.getElementById(`avail-end-${i}`);

                const defaultHours = AppUtils.getPharmacyHours(dow);
                let start = defaultHours.open;
                let end = defaultHours.close;

                if (isAvail) {
                    start = AppUtils.normalizeTime(startInput.value);
                    end = AppUtils.normalizeTime(endInput.value);
                    const weekLabel = i < 7 ? 'Semaine 1' : 'Semaine 2';
                    const dayLabel = `${weekLabel} - ${dayNamesFr[dow]}`;

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
                }

                availabilities.push({
                    dayOfWeek: dow,
                    weekStart: i < 7 ? weekStart : week2Start,
                    isAvailable: isAvail,
                    isFixed: isAvail ? isFixed : false,
                    startTime: start,
                    endTime: end
                });
            }

            const employeeType = document.getElementById('avail-emp-type').value;
            const weeklyHoursTarget = parseFloat(document.getElementById('avail-hours-target').value) || 37.5;
            const seniority = parseInt(document.getElementById('avail-seniority').value) || 10;
            const lunchBreakMinutes = parseInt(document.getElementById('avail-break-minutes').value) || 0;
            const maxEveningInput = document.getElementById('avail-max-evening').value;
            const maxEveningShifts = maxEveningInput !== '' ? parseInt(maxEveningInput, 10) : undefined;
            const isFormation = document.getElementById('avail-is-formation').checked;
            const isHeadCashier = document.getElementById('avail-is-head-cashier').checked;

            const vacations = [];
            document.querySelectorAll('.vacation-row').forEach(row => {
                const start = row.querySelector('.vac-start').value;
                const end = row.querySelector('.vac-end').value;
                if (start && end) {
                    vacations.push({ startDate: start, endDate: end });
                }
            });

            const username = document.getElementById('avail-username').value.trim();
            const password = document.getElementById('avail-password').value;

            try {
                await AppState.updateEmployeeAvailability(empId, availabilities, employeeType, weeklyHoursTarget, seniority, lunchBreakMinutes, maxEveningShifts, isFormation, isHeadCashier, vacations, weekStart, username, password);
                // Reload data from DB to confirm what was actually saved
                await AppState.loadData();
                AppUI.renderEmployees();
                alert('Disponibilités sauvegardées avec succès !');
            } catch (err) {
                alert('Erreur : ' + err.message);
                console.error(err);
            }
        });

        // Modale Employee Action
        const empActionModal = document.getElementById('employee-action-modal');
        const closeEmpActionModalBtn = document.getElementById('close-emp-action-modal');
        const cancelEmpActionBtn = document.getElementById('emp-action-cancel-btn');
        const deleteEmpActionBtn = document.getElementById('emp-action-delete-btn');

        closeEmpActionModalBtn.addEventListener('click', () => AppUI.closeEmployeeActionModal());
        cancelEmpActionBtn.addEventListener('click', () => AppUI.closeEmployeeActionModal());



        deleteEmpActionBtn.addEventListener('click', async () => {
            const empId = document.getElementById('emp-action-modal-id').value;
            const startStr = document.getElementById('emp-action-modal-start').value;
            const name = document.getElementById('emp-action-modal-title').textContent.replace('Gérer - ', '');

            const deleteW1 = document.getElementById('emp-action-week-1').checked;
            const deleteW2 = document.getElementById('emp-action-week-2').checked;

            if (!deleteW1 && !deleteW2) {
                alert("Veuillez sélectionner au moins une semaine à effacer.");
                return;
            }

            if (confirm(`Voulez-vous vraiment effacer les horaires sélectionnés pour ${name} ?`)) {
                try {
                    const [year, month, day] = startStr.split('-').map(Number);
                    const periodStart = new Date(year, month - 1, day);
                    const fmt = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

                    if (deleteW1) {
                        const w1End = new Date(periodStart);
                        w1End.setDate(periodStart.getDate() + 6);
                        await AppState.deleteEmployeeScheduleRange(empId, fmt(periodStart), fmt(w1End));
                    }
                    if (deleteW2) {
                        const w2Start = new Date(periodStart);
                        w2Start.setDate(periodStart.getDate() + 7);
                        const w2End = new Date(w2Start);
                        w2End.setDate(w2Start.getDate() + 6);
                        await AppState.deleteEmployeeScheduleRange(empId, fmt(w2Start), fmt(w2End));
                    }

                    AppUI.closeEmployeeActionModal();
                    AppUI.renderApp();
                } catch (err) {
                    alert('Erreur : ' + err.message);
                }
            }
        });

        // Modale Génération
        const generateModal = document.getElementById('generate-modal');
        document.getElementById('close-generate-modal').addEventListener('click', () => generateModal.classList.add('hidden'));

        // Tab switching in Generate Modal
        const tabWeeks = document.getElementById('gen-tab-weeks');
        const tabRules = document.getElementById('gen-tab-rules');
        const secWeeks = document.getElementById('gen-section-weeks');
        const secRules = document.getElementById('gen-section-rules');
        const runBtn   = document.getElementById('run-generate-btn');

        tabWeeks.addEventListener('click', () => {
            tabWeeks.className = 'btn-primary';
            tabRules.className = 'btn-secondary';
            secWeeks.style.display = 'block';
            secRules.style.display = 'none';
            runBtn.style.display = 'block';
        });

        tabRules.addEventListener('click', () => {
            tabRules.className = 'btn-primary';
            tabWeeks.className = 'btn-secondary';
            secRules.style.display = 'block';
            secWeeks.style.display = 'none';
            runBtn.style.display = 'none';
            AppUI.updateGenerateRuleDayOptions();
            AppUI.renderRuleShifts(document.getElementById('gen-rule-day').value);
        });

        document.getElementById('gen-rule-week').addEventListener('change', () => {
            AppUI.updateGenerateRuleDayOptions();
            AppUI.renderRuleShifts(document.getElementById('gen-rule-day').value);
        });

        document.getElementById('gen-rule-day').addEventListener('change', (e) => {
            AppUI.renderRuleShifts(e.target.value);
        });

        document.getElementById('gen-rule-copy-s1-s2').addEventListener('click', async () => {
            if (!confirm('Voulez-vous copier les besoins de la Semaine 1 vers la Semaine 2 ?')) return;

            const week1Start = AppUI.getGenerateRuleWeekStart(0);
            const week2Start = AppUI.getGenerateRuleWeekStart(1);
            const payloadRules = [];

            for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek++) {
                const sourceRule = AppUI.getGenerateRuleForContext(dayOfWeek, week1Start);
                const clonedShifts = (sourceRule.requiredShifts || []).map(s => ({
                    startTime: s.startTime,
                    endTime: s.endTime,
                    count: s.count
                }));

                let targetRule = AppUI.findGenerateRuleExact(dayOfWeek, week2Start);
                if (!targetRule) {
                    targetRule = { dayOfWeek, weekStart: week2Start, isOpen: true, requiredShifts: [] };
                    AppState.shiftRules.push(targetRule);
                }

                targetRule.isOpen = true;
                targetRule.requiredShifts = clonedShifts;

                payloadRules.push({
                    dayOfWeek,
                    weekStart: week2Start,
                    isOpen: true,
                    requiredShifts: clonedShifts
                });
            }

            try {
                await AppState.saveShiftRules(payloadRules);
                AppUI.renderRuleShifts(document.getElementById('gen-rule-day').value);
                alert('Besoins copiés de S1 vers S2.');
            } catch (err) {
                alert('Erreur : ' + err.message);
            }
        });

        document.getElementById('gen-rule-add-shift').addEventListener('click', () => {
            const dayStr = document.getElementById('gen-rule-day').value;
            const weekOffset = parseInt(document.getElementById('gen-rule-week').value, 10) || 0;
            const dayNum = parseInt(dayStr, 10);
            const weekStart = AppUI.getGenerateRuleWeekStart(weekOffset);

            let rule = AppUI.findGenerateRuleExact(dayNum, weekStart);
            if (!rule) {
                const baseRule = AppUI.getGenerateRuleForContext(dayNum, weekStart);
                rule = {
                    dayOfWeek: dayNum,
                    weekStart,
                    isOpen: true,
                    requiredShifts: (baseRule.requiredShifts || []).map(s => ({
                        startTime: s.startTime,
                        endTime: s.endTime,
                        count: s.count
                    }))
                };
                AppState.shiftRules.push(rule);
            }
            rule.isOpen = true;
            rule.requiredShifts.push({ startTime: '09:00', endTime: '17:00', count: 1 });
            AppUI.renderRuleShifts(dayStr);
        });

        document.getElementById('gen-rule-save').addEventListener('click', async () => {
            // Read current form state and save to AppState for the currently selected day
            const dayStr = document.getElementById('gen-rule-day').value;
            const dayNum = parseInt(dayStr, 10);
            const weekOffset = parseInt(document.getElementById('gen-rule-week').value, 10) || 0;
            const weekStart = AppUI.getGenerateRuleWeekStart(weekOffset);
            
            let rule = AppUI.findGenerateRuleExact(dayNum, weekStart);
            if (!rule) {
                rule = { dayOfWeek: dayNum, weekStart, isOpen: true, requiredShifts: [] };
                AppState.shiftRules.push(rule);
            }
            
            rule.isOpen = true;
            rule.requiredShifts = [];

            const shiftDivs = document.getElementById('gen-rule-shifts-container').children;
            for (let div of shiftDivs) {
                if (div.tagName.toLowerCase() !== 'div') continue; // skip text elements
                
                let start = div.querySelector('.rule-start').value;
                let end = div.querySelector('.rule-end').value;
                if (start.length === 4) start = '0' + start;
                if (end.length === 4) end = '0' + end;
                
                const count = parseInt(div.querySelector('.rule-count').value) || 1;
                
                rule.requiredShifts.push({ startTime: start, endTime: end, count });
            }

            AppState.shiftRules.forEach(r => {
                r.isOpen = true;
            });
            
            try {
                const payloadRule = {
                    dayOfWeek: rule.dayOfWeek,
                    weekStart: rule.weekStart,
                    isOpen: true,
                    requiredShifts: rule.requiredShifts
                };

                await AppState.saveShiftRules([payloadRule]);
                alert("Règles sauvegardées avec succès.");
            } catch (err) {
                alert('Erreur : ' + err.message);
            }
        });


        document.getElementById('run-generate-btn').addEventListener('click', async () => {
            const periodStart = AppUtils.getStartOfWeek(AppState.currentDate);
            const week1Start = new Date(periodStart);
            const week1End = new Date(periodStart); week1End.setDate(week1Start.getDate() + 6);
            const week2Start = new Date(periodStart); week2Start.setDate(week1Start.getDate() + 7);
            const week2End = new Date(periodStart); week2End.setDate(week1Start.getDate() + 13);

            const doWeek1 = document.getElementById('gen-week-1').checked;
            const doWeek2 = document.getElementById('gen-week-2').checked;

            if (!doWeek1 && !doWeek2) { alert('Veuillez sélectionner au moins une semaine.'); return; }

            const fmt = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

            const start = doWeek1 ? fmt(week1Start) : fmt(week2Start);
            const end = doWeek2 ? fmt(week2End) : fmt(week1End);

            const warningsDiv = document.getElementById('generate-warnings');
            warningsDiv.style.display = 'none';
            warningsDiv.innerHTML = '';

            try {
                const result = await AppState.generateSchedule(start, end, fmt(periodStart));
                if (result.warnings && result.warnings.length > 0) {
                    warningsDiv.innerHTML = '<strong>⚠ Avertissements :</strong><ul>' +
                        result.warnings.map(w => `<li>${w}</li>`).join('') + '</ul>';
                    warningsDiv.style.display = 'block';
                }
                generateModal.classList.add('hidden');
                AppUI.renderApp();
                alert(`Horaire généré ! ${result.shifts.length} quart(s) créé(s).`);
            } catch (err) {
                alert('Erreur : ' + err.message);
            }
        });
    }
};

// Démarrage de l'application
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
