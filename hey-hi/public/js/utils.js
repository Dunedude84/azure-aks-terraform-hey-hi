const AppUtils = {
    // Live-formats a time <input> as the user types digits (e.g. "900" -> "9:00", "1730" -> "17:30").
    // A leading digit of 3-9 can only be a single-digit hour (3h-9h), since no valid hour
    // starts with 3-9 as its tens digit; digits 0-2 keep the hour two-digit until disambiguated.
    formatTimeInput: function (e) {
        const digits = e.target.value.replace(/[^0-9]/g, '').slice(0, 4);
        let formatted = digits;

        if (digits.length === 2) {
            formatted = digits[0] >= '3' ? `${digits[0]}:${digits[1]}` : digits;
        } else if (digits.length === 3) {
            formatted = digits[0] >= '3'
                ? `${digits[0]}:${digits.slice(1)}`
                : `${digits.slice(0, 2)}:${digits[2]}`;
        } else if (digits.length === 4) {
            formatted = `${digits.slice(0, 2)}:${digits.slice(2, 4)}`;
        }

        e.target.value = formatted;
    },

    parseLocalDate: function(dateStr) {
        const [y, m, d] = dateStr.split('-').map(Number);
        return new Date(y, m - 1, d);
    },

    getStartOfWeek: function (date) {
        const d = new Date(date);
        const day = d.getDay();
        const diff = d.getDate() - day; // Sunday is 0
        return new Date(d.getFullYear(), d.getMonth(), diff);
    },

    validateTime: function (timeStr) {
        const regex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
        return regex.test(timeStr);
    },

    // Parses "9", "9:00", "09:00", "900", "9h", "9h30", "9pm", etc.
    // Returns a normalized "HH:MM" (24h) string, or null if the input can't be parsed.
    normalizeTime: function (raw) {
        if (raw === null || raw === undefined) return null;
        let s = String(raw).trim().toLowerCase().replace(/\s+/g, '');
        if (!s) return null;

        let pm = false;
        if (/pm$/.test(s)) { pm = true; s = s.replace(/pm$/, ''); }
        else if (/am$/.test(s)) { s = s.replace(/am$/, ''); }

        s = s.replace('h', ':').replace(/[^0-9:]/g, '');
        if (!s) return null;

        const digitsOnly = s.replace(/:/g, '');

        const parseDigits = (digits) => {
            if (digits.length <= 2) return { hours: parseInt(digits, 10), minutes: 0 };
            if (digits.length === 3) return { hours: parseInt(digits.slice(0, 1), 10), minutes: parseInt(digits.slice(1), 10) };
            if (digits.length === 4) return { hours: parseInt(digits.slice(0, 2), 10), minutes: parseInt(digits.slice(2), 10) };
            return null;
        };

        const isValid = (h, m) => !isNaN(h) && !isNaN(m) && h >= 0 && h <= 23 && m >= 0 && m <= 59;

        let hours, minutes;
        if (s.includes(':')) {
            const parts = s.split(':');
            if (parts.length !== 2) return null;
            const colonHours = parseInt(parts[0], 10);
            const colonMinutes = parts[1] === '' ? 0 : parseInt(parts[1], 10);

            if (isValid(colonHours, colonMinutes)) {
                hours = colonHours;
                minutes = colonMinutes;
            } else {
                // Auto-insertion of ":" while typing (e.g. "900" -> "90:0") can produce an
                // invalid colon split; fall back to interpreting the raw digits instead.
                const fallback = parseDigits(digitsOnly);
                if (!fallback) return null;
                hours = fallback.hours;
                minutes = fallback.minutes;
            }
        } else {
            const parsed = parseDigits(s);
            if (!parsed) return null;
            hours = parsed.hours;
            minutes = parsed.minutes;
        }

        if (isNaN(hours) || isNaN(minutes)) return null;
        if (pm && hours < 12) hours += 12;
        if (hours === 24) hours = 0;
        if (!isValid(hours, minutes)) return null;

        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    },

    timeToMinutes: function (timeStr) {
        const [h, m] = timeStr.split(':').map(Number);
        return h * 60 + m;
    },

    // Pharmacy opening hours (standard hours, used as default for new employees / display only):
    // open 09:00 every day, closes 20:00 on Sun/Sat, 21:00 other days.
    // Employees can still work outside these hours (e.g. arriving early), so availabilities
    // are NOT clamped to this range - a full 24h range is allowed.
    getPharmacyHours: function (dayOfWeek) {
        return {
            open: '09:00',
            close: (dayOfWeek === 0 || dayOfWeek === 6) ? '20:00' : '21:00'
        };
    },

    // Normalizes a time <input> value. Availabilities allow a full 24h range (00:00-23:59)
    // since employees may work before/after the pharmacy's standard opening hours.
    // Reverts to the last valid value if the input can't be parsed at all.
    enforceTimeBounds: function (inputEl, dayOfWeek) {
        const raw = inputEl.value;
        const normalized = this.normalizeTime(raw);

        if (!normalized) {
            alert(`Heure invalide : "${raw}". Utilisez le format HH:MM (ex: 09:00).`);
            inputEl.value = inputEl.dataset.lastValid || '';
            inputEl.focus();
            return;
        }

        inputEl.value = normalized;
        inputEl.dataset.lastValid = normalized;
    },

    formatDate: function (date) {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    },

    getDaysInMonth: function (year, month) {
        return new Date(year, month + 1, 0).getDate();
    },

    getWeeksInMonth: function (year, month) {
        const weeks = [];
        const daysInMonth = this.getDaysInMonth(year, month);

        // Start from the first day of the month
        let currentDay = 1;

        while (currentDay <= daysInMonth) {
            // Find the start of this week (Sunday = 0)
            const startDate = new Date(year, month, currentDay);
            const dayOfWeek = startDate.getDay();

            // Calculate the start of the week (Sunday)
            const weekStart = new Date(startDate);
            weekStart.setDate(startDate.getDate() - dayOfWeek);

            // Calculate the end of the week (Saturday)
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekStart.getDate() + 6);

            // Adjust to make sure we don't go past the month
            const actualWeekStartDay = weekStart.getDate();
            const actualWeekEndDay = Math.min(weekEnd.getDate(), daysInMonth);

            weeks.push({
                start: actualWeekStartDay,
                end: actualWeekEndDay,
                hours: 0
            });

            // Move to the next week
            currentDay += 7;
        }
        return weeks;
    }
};
