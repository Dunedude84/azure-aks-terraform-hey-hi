Object.assign(AppUI, {
renderSummary() {
    this.elements.summaryContainer.innerHTML = '';
    if (AppState.employees.length === 0) {
        this.elements.summaryContainer.innerHTML = '<p class="text-muted">Aucune donnée.</p>';
        return;
    }

    const startDate = AppUtils.getStartOfWeek(AppState.currentDate);
    const week1End = new Date(startDate);
    week1End.setDate(startDate.getDate() + 6);
    const periodEnd = new Date(startDate);
    periodEnd.setDate(startDate.getDate() + 13);
    const periodStartStr = AppUtils.formatDate(startDate);
    const week1EndStr = AppUtils.formatDate(week1End);
    const periodEndStr = AppUtils.formatDate(periodEnd);

    const monthNames = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
    const week2Start = new Date(startDate);
    week2Start.setDate(startDate.getDate() + 7);
    const week1Label = ` ${startDate.getDate()} au ${week1End.getDate()} ${monthNames[week1End.getMonth()]}`;
    const week2Label = ` ${week2Start.getDate()} au ${periodEnd.getDate()} ${monthNames[periodEnd.getMonth()]}`;

    let totalHours = 0;
    const weekFilter = AppState.summaryWeekFilter || 'both';

    AppState.employees.forEach(employee => {
        const employeeShifts = AppState.shifts.filter(shift => {
            return shift.employeeId === employee.id &&
                shift.date >= periodStartStr &&
                shift.date <= periodEndStr;
        });

        let week1Hours = 0;
        let week2Hours = 0;

        employeeShifts.forEach(shift => {
            if (shift.code || !shift.startTime || !shift.endTime) return;

            const startStr = shift.startTime.padStart(5, '0');
            const endStr = shift.endTime.padStart(5, '0');

            if (!AppUtils.validateTime(startStr) || !AppUtils.validateTime(endStr)) return;

            const start = new Date(`1970-01-01T${startStr}:00`);
            const end = new Date(`1970-01-01T${endStr}:00`);

            if (end < start) end.setDate(end.getDate() + 1);

            const diffMs = end - start;
            const hours = (diffMs / (1000 * 60 * 60)) - ((shift.breakMinutes || 0) / 60);
            const finalHours = hours > 0 ? hours : 0;

            if (shift.date <= week1EndStr) week1Hours += finalHours;
            else week2Hours += finalHours;
        });

        let displayedTotal;
        if (weekFilter === 'week1') displayedTotal = week1Hours;
        else if (weekFilter === 'week2') displayedTotal = week2Hours;
        else displayedTotal = week1Hours + week2Hours;

        if (displayedTotal > 0) {
            totalHours += displayedTotal;

            const card = document.createElement('div');
            card.className = 'summary-card';

            let bodyHtml = '';
            if (weekFilter === 'both' || weekFilter === 'week1') {
                bodyHtml += `
                    <div class="week-row">
                        <span class="week-label">${week1Label}</span>
                        <span class="week-hours">${week1Hours.toFixed(2)} h</span>
                    </div>`;
            }
            if (weekFilter === 'both' || weekFilter === 'week2') {
                bodyHtml += `
                    <div class="week-row">
                        <span class="week-label">${week2Label}</span>
                        <span class="week-hours">${week2Hours.toFixed(2)} h</span>
                    </div>`;
            }

            card.innerHTML = `
                <div class="summary-header">
                    <span class="summary-name">${employee.name}</span>
                    <span class="summary-hours">${displayedTotal.toFixed(2)} h</span>
                </div>
                <div class="summary-body">
                    ${bodyHtml}
                </div>
            `;
            this.elements.summaryContainer.appendChild(card);
        }
    });

    if (totalHours === 0) {
        this.elements.summaryContainer.innerHTML = '<p class="text-muted">Aucun horaire enregistré pour cette période.</p>';
    }
}
});
