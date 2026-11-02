// Shared time parsing/validation helpers for availability & shift inputs (server-side).
// Mirrors the logic in public/js/utils.js (AppUtils.normalizeTime / getPharmacyHours).

// Parses "9", "9:00", "09:00", "900", "9h", "9h30", "9pm", etc.
// Returns a normalized "HH:MM" (24h) string, or null if the input can't be parsed.
function normalizeTime(raw) {
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
}

function timeToMinutes(timeStr) {
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
}

// Pharmacy opening hours: open 09:00 every day, closes 20:00 on Sun/Sat, 21:00 other days.
function getPharmacyHours(dayOfWeek) {
    return {
        open: '09:00',
        close: (dayOfWeek === 0 || dayOfWeek === 6) ? '20:00' : '21:00'
    };
}

// Validates & normalizes a list of availability entries. Times are allowed over a full
// 24h range (employees may work before/after the pharmacy's standard opening hours).
// `dayOfWeek` on each entry may be 0-6 (single week) or 0-13 (legacy two-week format);
// the real weekday is `dayOfWeek % 7` (used only for day labels in error messages).
// Returns { availabilities, error } where `availabilities` has normalized start/end times,
// and `error` is a human-readable French message if validation failed (availabilities is then null).
function validateAndNormalizeAvailabilities(incoming) {
    const dayNamesFr = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
    const normalized = [];

    for (const entry of incoming) {
        if (!entry.isAvailable) {
            normalized.push({ ...entry, startTime: '00:00', endTime: '00:00' });
            continue;
        }

        const dow = ((entry.dayOfWeek % 7) + 7) % 7;
        const start = normalizeTime(entry.startTime);
        const end = normalizeTime(entry.endTime);
        const dayLabel = dayNamesFr[dow];

        if (!start || !end) {
            return { availabilities: null, error: `Heure invalide pour ${dayLabel}. Utilisez le format HH:MM (ex: 09:00).` };
        }

        if (timeToMinutes(start) >= timeToMinutes(end)) {
            return { availabilities: null, error: `${dayLabel} : l'heure de début doit être avant l'heure de fin.` };
        }

        normalized.push({ ...entry, startTime: start, endTime: end });
    }

    return { availabilities: normalized, error: null };
}

module.exports = {
    normalizeTime,
    timeToMinutes,
    getPharmacyHours,
    validateAndNormalizeAvailabilities
};
