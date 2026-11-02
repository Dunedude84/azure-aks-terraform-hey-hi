const AppState = {
    employees: [],
    shifts: [],
    shiftRules: [],
    currentDate: new Date(),
    currentDepartment: localStorage.getItem('currentDepartment') || 'caisses_avant',
    isGuest: false,
    summaryWeekFilter: 'both',

    // Vérifie la session courante et détermine si l'utilisateur navigue en mode invité
    checkSession: async function() {
        try {
            const res = await fetch('/api/auth/me');
            const data = await res.json();
            this.isGuest = !!data.guest;
            return data;
        } catch (error) {
            console.error('Error checking session:', error);
            return null;
        }
    },

    // Bloque une action si l'utilisateur est en mode invité (démonstration en lecture seule)
    blockIfGuest: function() {
        if (this.isGuest) {
            alert("Mode invité : cette action est désactivée. Aucune modification n'est enregistrée.");
            return true;
        }
        return false;
    },

    sortEmployees: function() {
        this.employees.sort((a, b) => {
            const sA = a.seniority !== undefined ? a.seniority : 10;
            const sB = b.seniority !== undefined ? b.seniority : 10;
            return sA - sB;
        });
    },

    loadData: async function() {
        try {
            const [empRes, shiftRes, rulesRes] = await Promise.all([
                fetch(`/api/employees?department=${this.currentDepartment}`),
                fetch(`/api/shifts?department=${this.currentDepartment}`),
                fetch(`/api/shift-rules?department=${this.currentDepartment}`)
            ]);
            this.employees  = await empRes.json();
            this.sortEmployees();
            this.shifts     = await shiftRes.json();
            this.shiftRules = await rulesRes.json();
        } catch (error) {
            console.error("Error loading data:", error);
        }
    },

    addEmployee: async function(name) {
        if (this.blockIfGuest()) return;
        try {
            const res = await fetch('/api/employees', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, department: this.currentDepartment })
            });
            const newEmp = await res.json();
            if (!res.ok) throw new Error(newEmp.message || "Erreur lors de l'ajout");
            this.employees.push(newEmp);
            this.sortEmployees();
        } catch (error) {
            console.error("Error adding employee:", error);
            alert('Erreur : ' + error.message);
        }
    },

    removeEmployee: async function(id) {
        if (this.blockIfGuest()) return;
        try {
            const res = await fetch(`/api/employees/${id}`, { method: 'DELETE' });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.message || 'Erreur lors de la suppression');
            }
            this.employees = this.employees.filter(emp => emp.id !== id);
            this.shifts = this.shifts.filter(shift => shift.employeeId !== id);
        } catch (error) {
            console.error("Error removing employee:", error);
            alert('Erreur : ' + error.message);
        }
    },

    saveShift: async function(shiftData, shiftId) {
        if (this.blockIfGuest()) return;
        try {
            const payload = { ...shiftData, force: true };
            if (shiftId) payload.shiftId = shiftId;

            const res = await fetch('/api/shifts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...payload, department: this.currentDepartment })
            });
            const savedShift = await res.json();

            if (!res.ok) throw new Error(savedShift.message || 'Erreur lors de la sauvegarde');

            if (shiftId) {
                const index = this.shifts.findIndex(s => s.id === shiftId);
                if (index > -1) {
                    this.shifts[index] = savedShift;
                }
            } else {
                // Remove existing local match
                this.shifts = this.shifts.filter(s => !(s.employeeId === shiftData.employeeId && s.date === shiftData.date));
                this.shifts.push(savedShift);
            }
        } catch (error) {
            console.error("Error saving shift:", error);
            alert('Erreur : ' + error.message);
        }
    },

    moveShift: async function(shift, newEmployeeId, newDate) {
        if (this.isGuest) {
            const shiftId = shift.id || shift._id;
            if (!shiftId) return null;

            this.shifts = this.shifts.filter(s => !(s.employeeId === newEmployeeId && s.date === newDate && (s.id || s._id) !== shiftId));

            const index = this.shifts.findIndex(s => (s.id || s._id) === shiftId);
            if (index === -1) return null;

            const movedShift = {
                ...this.shifts[index],
                employeeId: newEmployeeId,
                date: newDate
            };
            this.shifts[index] = movedShift;
            return movedShift;
        }
        try {
            // If the target cell already has a shift, remove it first (it gets overwritten)
            const conflicting = this.shifts.find(s => s.employeeId === newEmployeeId && s.date === newDate && s.id !== shift.id);
            if (conflicting) {
                await this.deleteShift(conflicting.id);
            }

            const payload = {
                employeeId: newEmployeeId,
                date: newDate,
                startTime: shift.startTime,
                endTime: shift.endTime,
                breakMinutes: shift.breakMinutes || 0,
                isFormation: shift.isFormation || false,
                hasStar: shift.hasStar || false,
                shiftId: shift.id,
                force: true,
                department: this.currentDepartment
            };

            const res = await fetch('/api/shifts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const savedShift = await res.json();
            if (!res.ok) throw new Error(savedShift.message || 'Erreur lors du déplacement');

            const index = this.shifts.findIndex(s => s.id === shift.id);
            if (index > -1) {
                this.shifts[index] = savedShift;
            }
            return savedShift;
        } catch (error) {
            console.error("Error moving shift:", error);
            alert('Erreur : ' + error.message);
        }
    },

    deleteShift: async function(shiftId) {
        if (this.blockIfGuest()) return;
        try {
            const res = await fetch(`/api/shifts/${shiftId}`, { method: 'DELETE' });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.message || 'Erreur lors de la suppression');
            }
            this.shifts = this.shifts.filter(s => s.id !== shiftId);
        } catch (error) {
            console.error("Error deleting shift:", error);
            alert('Erreur : ' + error.message);
        }
    },

    updateEmployeeAvailability: async function(employeeId, availabilities, employeeType, weeklyHoursTarget, seniority, lunchBreakMinutes, maxEveningShifts, isFormation, isHeadCashier, vacations, weekStart, username, password) {
        if (this.blockIfGuest()) return;
        const payload = { availabilities, employeeType, weeklyHoursTarget, seniority, lunchBreakMinutes, isFormation, isHeadCashier, vacations, weekStart };
        if (maxEveningShifts !== undefined) payload.maxEveningShifts = maxEveningShifts;
        if (username !== undefined) payload.username = username;
        if (password) payload.password = password;
        const res = await fetch(`/api/employees/${employeeId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!res.ok) {
            throw new Error(data.message || 'Erreur lors de la sauvegarde');
        }
        const index = this.employees.findIndex(e => e.id === employeeId);
        if (index > -1) {
            this.employees[index] = data;
        }
        this.sortEmployees();
        return data;
    },

    generateSchedule: async function(startDate, endDate, periodStart) {
            if (this.blockIfGuest()) return;
            const res = await fetch('/api/schedule/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ startDate, endDate, periodStart, department: this.currentDepartment })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Erreur lors de la génération');
        
        // Reload all data to ensure UI matches DB exactly (and no duplicates are kept)
        await this.loadData();
        return data; // contains { shifts, warnings }
    },

    deleteScheduleRange: async function(startDate, endDate) {
            if (this.blockIfGuest()) return;
            const res = await fetch('/api/schedule/delete-range', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ startDate, endDate, department: this.currentDepartment })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Erreur lors de la suppression');
        await this.loadData();
        return data;
    },

    deleteEmployeeScheduleRange: async function(employeeId, startDate, endDate) {
            if (this.blockIfGuest()) return;
            const res = await fetch('/api/schedule/delete-employee-range', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ employeeId, startDate, endDate, department: this.currentDepartment })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Erreur lors de la suppression');
        await this.loadData();
        return data;
    },

    saveShiftRules: async function(rules) {
            if (this.blockIfGuest()) return;
            const res = await fetch('/api/shift-rules', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ rules, department: this.currentDepartment })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Erreur lors de la sauvegarde des règles');
        this.shiftRules = data;
        return data;
    }
};
