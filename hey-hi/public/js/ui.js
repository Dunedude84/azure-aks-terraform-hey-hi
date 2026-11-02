const AppUI = {
    elements: {},

    init: function () {
        this.elements = {
            scheduleThead1: document.getElementById('schedule-thead-1'),
            scheduleTbody1: document.getElementById('schedule-tbody-1'),
            scheduleThead2: document.getElementById('schedule-thead-2'),
            scheduleTbody2: document.getElementById('schedule-tbody-2'),
            currentMonthDisplay: document.getElementById('current-month-display'),
            currentMonthDisplayBottom: document.getElementById('current-month-display-bottom'),
            employeesList: document.getElementById('employees-list'),
            summaryContainer: document.getElementById('summary-container'),
            summaryMonthLabel: document.getElementById('summary-month-label'),
            shiftModal: document.getElementById('shift-modal'),
            modalTitle: document.getElementById('modal-title'),
            modalSubtitle: document.getElementById('modal-subtitle'),
            modalEmployeeId: document.getElementById('modal-employee-id'),
            modalDate: document.getElementById('modal-date'),
            modalStartTime: document.getElementById('modal-start-time'),
            modalEndTime: document.getElementById('modal-end-time'),
            modalDeleteBtn: document.getElementById('modal-delete-btn'),
            availModal: document.getElementById('availability-modal'),
            availModalTitle: document.getElementById('avail-modal-title'),
            availModalEmpId: document.getElementById('avail-modal-employee-id'),
            availList: document.getElementById('availabilities-list'),
            empActionModal: document.getElementById('employee-action-modal'),
            empActionModalTitle: document.getElementById('emp-action-modal-title'),
            empActionModalSubtitle: document.getElementById('emp-action-modal-subtitle'),
            empActionModalId: document.getElementById('emp-action-modal-id'),
            empActionModalStart: document.getElementById('emp-action-modal-start'),
            empActionModalEnd: document.getElementById('emp-action-modal-end')
        };
    },

    renderApp: function () {
        this.updateMonthDisplay();
        this.renderEmployees();
        this.renderScheduleTable();
        this.renderSummary();
    },

    updateMonthDisplay: function () {
        const monthNames = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];

        const startDate = AppUtils.getStartOfWeek(AppState.currentDate);
        const endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 13);

        let displayText = '';
        if (startDate.getMonth() === endDate.getMonth()) {
            displayText = `Du ${startDate.getDate()} au ${endDate.getDate()} ${monthNames[startDate.getMonth()]} ${startDate.getFullYear()}`;
        } else if (startDate.getFullYear() === endDate.getFullYear()) {
            displayText = `Du ${startDate.getDate()} ${monthNames[startDate.getMonth()]} au ${endDate.getDate()} ${monthNames[endDate.getMonth()]} ${startDate.getFullYear()}`;
        } else {
            displayText = `Du ${startDate.getDate()} ${monthNames[startDate.getMonth()]} ${startDate.getFullYear()} au ${endDate.getDate()} ${monthNames[endDate.getMonth()]} ${endDate.getFullYear()}`;
        }

        this.elements.currentMonthDisplay.textContent = displayText;
        if (this.elements.currentMonthDisplayBottom) {
            this.elements.currentMonthDisplayBottom.textContent = displayText;
        }
        this.elements.summaryMonthLabel.textContent = displayText;
    }
    
    // Les autres méthodes (renderScheduleTable, renderEmployees, openModal, etc.)
    // sont maintenant définies dans les fichiers du dossier public/js/ui/
};