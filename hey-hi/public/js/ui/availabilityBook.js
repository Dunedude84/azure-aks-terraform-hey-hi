Object.assign(AppUI, {
    openAvailabilityBookModal: function () {
        this.renderAvailabilityBook();
        this.elements.availabilityBookModal.classList.remove('hidden');
    },

    closeAvailabilityBookModal: function () {
        this.elements.availabilityBookModal.classList.add('hidden');
    },

    renderAvailabilityBook: function () {
        const employeeSelect = this.elements.abEmployee;
        const dateSelect = this.elements.abDate;
        const listContainer = this.elements.availabilityBookList;
        const statusSelect = this.elements.abStatus;
        const noteInput = this.elements.abNote;

        employeeSelect.innerHTML = '';
        dateSelect.innerHTML = '';
        listContainer.innerHTML = '';

        // Populate employees
        AppState.employees.forEach(emp => {
            const option = document.createElement('option');
            option.value = emp.id;
            option.textContent = emp.name;
            employeeSelect.appendChild(option);
        });

        if (AppState.employees.length === 0) {
            const option = document.createElement('option');
            option.value = '';
            option.textContent = 'Aucun employé';
            employeeSelect.appendChild(option);
            employeeSelect.disabled = true;
        } else {
            employeeSelect.disabled = false;
        }

        // Populate dates for the current 2-week period
        const startOfWeek = AppUtils.getStartOfWeek(AppState.currentDate);
        const dayNames = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
        const monthNames = ['janv.', 'fév.', 'mars', 'avr.', 'mai', 'juin', 'juill.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
        const dates = [];

        for (let i = 0; i < 14; i++) {
            const d = new Date(startOfWeek);
            d.setDate(d.getDate() + i);
            const dateStr = AppUtils.formatDate(d);
            const label = `${dayNames[d.getDay()]} ${d.getDate()} ${monthNames[d.getMonth()]}`;
            dates.push({ dateStr, label, d });

            const option = document.createElement('option');
            option.value = dateStr;
            option.textContent = label;
            dateSelect.appendChild(option);
        }

        // Group notes by date
        const notesByDate = {};
        AppState.availabilityNotes.forEach(note => {
            if (!notesByDate[note.date]) notesByDate[note.date] = [];
            notesByDate[note.date].push(note);
        });

        const hasAnyNotes = Object.keys(notesByDate).length > 0;
        if (!hasAnyNotes) {
            listContainer.innerHTML = '<p class="text-muted" style="text-align:center; padding: 20px;">Aucune note pour cette période.</p>';
        }

        dates.forEach(({ dateStr, label }) => {
            const notes = notesByDate[dateStr] || [];

            const dayCard = document.createElement('div');
            dayCard.style.cssText = 'border: 1px solid var(--border-color); border-radius: 8px; padding: 12px; background: white;';

            const header = document.createElement('div');
            header.style.cssText = 'font-weight: 600; font-size: 1rem; margin-bottom: 8px; color: var(--text-main);';
            header.textContent = label;
            dayCard.appendChild(header);

            if (notes.length === 0) {
                const empty = document.createElement('p');
                empty.style.cssText = 'font-size: 0.85rem; color: var(--text-muted); font-style: italic; margin: 0;';
                empty.textContent = 'Aucune note';
                dayCard.appendChild(empty);
            } else {
                const notesContainer = document.createElement('div');
                notesContainer.style.cssText = 'display: flex; flex-direction: column; gap: 8px;';

                notes.forEach(note => {
                    const employee = AppState.employees.find(e => e.id === note.employeeId);
                    const empName = employee ? employee.name : 'Inconnu';

                    const row = document.createElement('div');
                    row.style.cssText = 'display: flex; align-items: center; gap: 10px; flex-wrap: wrap;';

                    const statusColors = {
                        'dispo': { bg: '#dcfce7', color: '#166534', border: '#86efac', label: 'Dispo' },
                        'non-dispo': { bg: '#fee2e2', color: '#991b1b', border: '#fca5a5', label: 'Non-dispo' },
                        'partial': { bg: '#ffedd5', color: '#9a3412', border: '#fdba74', label: 'Partiel' },
                        'other': { bg: '#f1f5f9', color: '#475569', border: '#cbd5e1', label: 'Note' }
                    };
                    const style = statusColors[note.status] || statusColors['other'];

                    const badge = document.createElement('span');
                    badge.style.cssText = `font-size: 0.75rem; font-weight: 600; padding: 2px 8px; border-radius: 999px; background: ${style.bg}; color: ${style.color}; border: 1px solid ${style.border};`;
                    badge.textContent = style.label;

                    const text = document.createElement('span');
                    text.style.cssText = 'font-size: 0.95rem; flex: 1; min-width: 120px;';
                    text.innerHTML = `<strong>${empName}</strong> ${note.note ? '— ' + note.note : ''}`;

                    const delBtn = document.createElement('button');
                    delBtn.className = 'btn-danger-outline';
                    delBtn.textContent = 'Retirer';
                    delBtn.style.cssText = 'padding: 3px 8px; font-size: 0.75rem;';
                    delBtn.onclick = async () => {
                        if (confirm(`Retirer la note de ${empName} pour ${label} ?`)) {
                            try {
                                await AppState.deleteAvailabilityNote(note.id);
                                this.renderAvailabilityBook();
                                this.renderScheduleTable();
                            } catch (err) {
                                alert('Erreur : ' + err.message);
                            }
                        }
                    };

                    row.appendChild(badge);
                    row.appendChild(text);
                    row.appendChild(delBtn);
                    notesContainer.appendChild(row);
                });

                dayCard.appendChild(notesContainer);
            }

            listContainer.appendChild(dayCard);
        });

        // Reset add form
        statusSelect.value = 'other';
        noteInput.value = '';
    }
});
