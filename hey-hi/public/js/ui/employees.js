Object.assign(AppUI, {
renderEmployees() {
    this.elements.employeesList.innerHTML = '';
    AppState.employees.forEach(employee => {
        const li = document.createElement('li');
        li.className = 'employee-item';

        const nameSpan = document.createElement('span');
        nameSpan.className = 'employee-name-display';
        nameSpan.textContent = employee.name;
        nameSpan.style.cursor = 'pointer';
        nameSpan.style.textDecoration = 'underline';
        nameSpan.style.color = 'var(--primary-color)';
        nameSpan.onclick = () => this.openAvailabilityModal(employee);

        // Type badge
        const typeBadge = document.createElement('span');
        const isFullTime = (employee.employeeType || 'temps-plein') === 'temps-plein';
        typeBadge.textContent = isFullTime ? 'Temps plein' : 'Temps partiel';
        typeBadge.style.cssText = `font-size:0.72rem; font-weight:600; padding:2px 7px; border-radius:999px;
            background:${isFullTime ? '#dbeafe' : '#fef3c7'}; color:${isFullTime ? '#1d4ed8' : '#92400e'}; white-space:nowrap;`;

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'btn-danger-outline';
        deleteBtn.textContent = 'Retirer';
        deleteBtn.onclick = async () => {
            if (confirm("Voulez-vous vraiment supprimer cet employé ? Tous ses horaires seront également supprimés.")) {
                await AppState.removeEmployee(employee.id);
                this.renderApp();
            }
        };

        const seniorityBadge = document.createElement('span');
        const seniorityVal = employee.seniority !== undefined ? employee.seniority : 10;
        seniorityBadge.textContent = '' + seniorityVal;
        seniorityBadge.style.cssText = `font-size:0.72rem; font-weight:600; padding:2px 7px; border-radius:999px;
            background:#e2e8f0; color:#475569; white-space:nowrap;`;

        const badgesContainer = document.createElement('div');
        badgesContainer.style.cssText = 'display:flex; gap:6px; flex-wrap:wrap; align-items:center;';
        
        
        if (employee.vacations && employee.vacations.length > 0) {
            const vacBadge = document.createElement('span');
            vacBadge.textContent = 'En vacances';
            vacBadge.style.cssText = `font-size:0.72rem; font-weight:600; padding:2px 7px; border-radius:999px;
                background:#fef08a; color:#854d0e; white-space:nowrap;`;
            badgesContainer.appendChild(vacBadge);
        }
        if (employee.isFormation) {
            const formationBadge = document.createElement('span');
            formationBadge.textContent = 'En formation';
            formationBadge.style.cssText = `font-size:0.72rem; font-weight:600; padding:2px 7px; border-radius:999px;
                background:#f3e8ff; color:#7e22ce; white-space:nowrap;`;
            badgesContainer.appendChild(formationBadge);
        }
        if (employee.isHeadCashier) {
            const headBadge = document.createElement('span');
            headBadge.textContent = 'Chef caissière';
            headBadge.style.cssText = `font-size:0.72rem; font-weight:600; padding:2px 7px; border-radius:999px;
                background:#dbeafe; color:#1d4ed8; white-space:nowrap;`;
            badgesContainer.appendChild(headBadge);
        }
        if (employee.username) {
            const credsBadge = document.createElement('span');
            credsBadge.textContent = `Accès: ${employee.username}`;
            credsBadge.style.cssText = `font-size:0.72rem; font-weight:600; padding:2px 7px; border-radius:999px;
            ;`
            badgesContainer.appendChild(credsBadge);
        }

        badgesContainer.appendChild(typeBadge);
        badgesContainer.appendChild(seniorityBadge);

        

        li.appendChild(nameSpan);
        li.appendChild(badgesContainer);
        li.appendChild(deleteBtn);
        this.elements.employeesList.appendChild(li);
    });
}
});
