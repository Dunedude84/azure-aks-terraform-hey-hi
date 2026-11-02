const Employee = require('../models/Employee');
const Shift = require('../models/Shift');
const ShiftRule = require('../models/ShiftRule');
const { DEFAULT_RULES } = require('./scheduleRules');

function normalizeWeekStart(ws) {
    return ws === null || ws === undefined ? null : ws;
}

function addDaysToDateStr(dateStr, days) {
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    date.setDate(date.getDate() + days);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function findAvailability(employee, dayOfWeek, isWeek1, weekStart) {
    const targetWeekStart = normalizeWeekStart(weekStart);

    if (!targetWeekStart) {
        const availDayOfWeek = isWeek1 ? dayOfWeek : dayOfWeek + 7;
        let avail = employee.availabilities.find(a => normalizeWeekStart(a.weekStart) === null && a.dayOfWeek === availDayOfWeek);
        if (!avail && !isWeek1) {
            avail = employee.availabilities.find(a => normalizeWeekStart(a.weekStart) === null && a.dayOfWeek === dayOfWeek);
        }
        return avail;
    }

    // Nouveau format : chaque semaine calendaire réelle a son propre weekStart
    // (dimanche de cette semaine précise) et dayOfWeek va de 0 à 6.
    // Un override spécifique à une semaine (disponible OU indisponible) est toujours
    // respecté tel quel : on ne retombe sur la disponibilité générique que s'il n'existe
    // aucun override pour cette semaine précise.
    let avail = employee.availabilities.find(a => {
        return normalizeWeekStart(a.weekStart) === targetWeekStart && a.dayOfWeek === dayOfWeek;
    });
    if (avail) return avail;

    // Ancien format (legacy) : weekStart = début de la période de 2 semaines,
    // dayOfWeek 0-6 pour la semaine 1 et 7-13 pour la semaine 2.
    const availDayOfWeek = isWeek1 ? dayOfWeek : dayOfWeek + 7;
    avail = employee.availabilities.find(a => {
        return normalizeWeekStart(a.weekStart) === targetWeekStart && a.dayOfWeek === availDayOfWeek;
    });
    if (avail) return avail;

    avail = employee.availabilities.find(a => {
        return normalizeWeekStart(a.weekStart) === null && a.dayOfWeek === availDayOfWeek;
    });

    if (!avail && !isWeek1) {
        avail = employee.availabilities.find(a => {
            return normalizeWeekStart(a.weekStart) === null && a.dayOfWeek === dayOfWeek;
        });
    }

    return avail;
}

function employeeCoversShift(employee, dayOfWeek, requiredStart, requiredEnd, isWeek1 = true, weekStart = null) {
    const avail = findAvailability(employee, dayOfWeek, isWeek1, weekStart);
    if (!avail || !avail.isAvailable) return false;
    return avail.startTime <= requiredStart && avail.endTime >= requiredEnd;
}

function getAvailabilityForDay(employee, dayOfWeek, isWeek1 = true, weekStart = null) {
    return findAvailability(employee, dayOfWeek, isWeek1, weekStart);
}

function getOverlap(employee, dayOfWeek, requiredStart, requiredEnd, isWeek1 = true, weekStart = null) {
    const avail = getAvailabilityForDay(employee, dayOfWeek, isWeek1, weekStart);
    if (!avail || !avail.isAvailable) return null;
    
    const [rsh, rsm] = requiredStart.split(':').map(Number);
    const [reh, rem] = requiredEnd.split(':').map(Number);
    const rStart = rsh * 60 + rsm;
    const rEnd = reh * 60 + rem;
    
    const [ash, asm] = avail.startTime.split(':').map(Number);
    const [aeh, aem] = avail.endTime.split(':').map(Number);
    const aStart = ash * 60 + asm;
    const aEnd = aeh * 60 + aem;
    
    const overlapStart = Math.max(rStart, aStart);
    const overlapEnd = Math.min(rEnd, aEnd);
    
    if (overlapEnd > overlapStart) {
        return {
            startTime: `${String(Math.floor(overlapStart / 60)).padStart(2, '0')}:${String(overlapStart % 60).padStart(2, '0')}`,
            endTime: `${String(Math.floor(overlapEnd / 60)).padStart(2, '0')}:${String(overlapEnd % 60).padStart(2, '0')}`,
            durationMins: overlapEnd - overlapStart
        };
    }
    return null;
}

function toMinutes(time) {
    if (typeof time !== 'string' || time === '') {
        console.warn('Valeur d\'heure invalide:', time);
        return NaN;
    }
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
}

function parseDate(dateStr) {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d);
}

function formatDate(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function getWeekStart(dateStr) {
    const date = parseDate(dateStr);
    date.setDate(date.getDate() - date.getDay());
    return formatDate(date);
}

function getSaturdayKey(dateStr) {
    const date = parseDate(dateStr);
    const day = date.getDay();
    if (day === 0) date.setDate(date.getDate() - 1);
    else if (day !== 6) date.setDate(date.getDate() + (6 - day));
    return formatDate(date);
}

function previousSaturday(satStr) {
    return addDaysToDateStr(satStr, -7);
}

function computeShiftHours(startTime, endTime, employee) {
    const raw = (toMinutes(endTime) - toMinutes(startTime)) / 60;
    const breakMins = raw >= 6 ? (employee ? employee.lunchBreakMinutes || 0 : 0) : 0;
    return raw - (breakMins / 60);
}

// Un quart est considéré "de soir" s'il se termine à l'heure de fermeture :
// 21h en semaine (lundi à vendredi), 20h la fin de semaine (samedi/dimanche).
// Ça inclut donc le bloc du milieu (ex. 12h-21h) ET le dernier bloc (ex. 16:45-21h),
// puisque les deux se terminent à la fermeture. On veut limiter le nombre de soirs
// par semaine par employé (idéalement 2, exceptionnellement jusqu'à 3) pour éviter
// qu'une même personne travaille systématiquement le soir.
function isEveningShift(endTime, dayOfWeek) {
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const closingTime = isWeekend ? toMinutes('20:00') : toMinutes('21:00');
    return toMinutes(endTime) >= closingTime;
}

function isEveningShiftForDate(endTime, dateStr) {
    return isEveningShift(endTime, parseDate(dateStr).getDay());
}

// Cible hebdomadaire effective d'un employé. Tous les employés du même type
// partagent la même cible pour garantir une répartition équitable.
function getEffectiveWeeklyTarget(employee) {
    return employee.weeklyHoursTarget || (employee.employeeType === 'temps-partiel' ? 20 : 37.5);
}

// Plafond de soirs par semaine pour un employé. Si non défini, on conserve
// l'ancien comportement (max 3 soirs/semaine).
function getMaxEveningShifts(employee) {
    return employee.maxEveningShifts !== undefined && employee.maxEveningShifts !== null
        ? employee.maxEveningShifts
        : 3;
}

function employeeCanCover(employee, subSlot, dayOfWeek, isWeek1, weekStart, dateStr, assignedSet) {
    if (employee.isFormation) return false;
    if (employee.isHeadCashier) return false;
    if ((employee.vacations || []).some(v => dateStr >= v.startDate && dateStr <= v.endDate)) return false;
    if (assignedSet && assignedSet.has(employee._id.toString())) return false;

    const avail = findAvailability(employee, dayOfWeek, isWeek1, weekStart);
    if (!avail || !avail.isAvailable) return false;

    if (avail.isFixed) {
        return avail.startTime === subSlot.startTime && avail.endTime === subSlot.endTime;
    }
    return toMinutes(avail.startTime) <= toMinutes(subSlot.startTime) &&
           toMinutes(avail.endTime) >= toMinutes(subSlot.endTime);
}

async function generateSchedule(department, startDate, endDate, periodStartStr) {
    const start = parseDate(startDate);
    const end = parseDate(endDate);
    const periodStart = periodStartStr ? parseDate(periodStartStr) : start;
    const periodStartString = periodStartStr || startDate;

    const [employees, dbRules] = await Promise.all([
        Employee.find({ department }),
        ShiftRule.find({ department }).sort({ dayOfWeek: 1 }).lean()
    ]);
    const rules = dbRules.length ? dbRules : DEFAULT_RULES;
    const genericRulesByDay = new Map();
    const specificRulesByWeekAndDay = new Map();

    for (const rule of rules) {
        const normalizedWeekStart = normalizeWeekStart(rule.weekStart);
        if (normalizedWeekStart) {
            specificRulesByWeekAndDay.set(`${normalizedWeekStart}|${rule.dayOfWeek}`, rule);
        } else {
            genericRulesByDay.set(rule.dayOfWeek, rule);
        }
    }

    const dates = [];
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        dates.push(formatDate(d));
    }

    await Shift.deleteMany({ department, date: { $gte: startDate, $lte: endDate } });

    const weeklyHours = {};
    const eveningCounts = {};
    const weeks = [...new Set(dates.map(getWeekStart))];
    for (const weekStart of weeks) {
        const weekEnd = addDaysToDateStr(weekStart, 6);
        const existingShifts = await Shift.find({ department, date: { $gte: weekStart, $lte: weekEnd } });
        const map = {};
        const eveningMap = {};
        for (const s of existingShifts) {
            if (s.isFormation) continue;
            const raw = (toMinutes(s.endTime) - toMinutes(s.startTime)) / 60;
            const breakMins = raw >= 6 ? (s.breakMinutes || 0) : 0;
            const dur = raw - (breakMins / 60);
            const empId = s.employeeId.toString();
            map[empId] = (map[empId] || 0) + dur;
            if (isEveningShiftForDate(s.endTime, s.date)) {
                eveningMap[empId] = (eveningMap[empId] || 0) + 1;
            }
        }
        weeklyHours[weekStart] = map;
        eveningCounts[weekStart] = eveningMap;
    }

    const totalHours = {};
    for (const w of Object.values(weeklyHours)) {
        for (const [empId, hours] of Object.entries(w)) {
            totalHours[empId] = (totalHours[empId] || 0) + hours;
        }
    }
    const numWeeks = weeks.length;

    const weekendWorkers = new Map();
    const assignedPerDate = {};
    const fixedShiftsByDate = {};
    const generatedShifts = [];
    const warnings = [];

    async function loadWeekendWorkers(satStr) {
        if (weekendWorkers.has(satStr)) return weekendWorkers.get(satStr);
        const sunStr = addDaysToDateStr(satStr, 1);
        const shifts = await Shift.find({ department, date: { $in: [satStr, sunStr] } });
        const set = new Set(shifts.filter(s => !s.isFormation).map(s => s.employeeId.toString()));
        weekendWorkers.set(satStr, set);
        return set;
    }

    if (dates.length > 0) {
        const firstSaturday = getSaturdayKey(dates[0]);
        await loadWeekendWorkers(previousSaturday(firstSaturday));
    }

    // Pré-affecter les créneaux "fixe" définis dans les disponibilités des employés
    for (const dateStr of dates) {
        const dateObj = parseDate(dateStr);
        const dayOfWeek = dateObj.getDay();
        const weekStart = getWeekStart(dateStr);
        const dayDiff = Math.floor((dateObj - periodStart) / (1000 * 60 * 60 * 24));
        const isWeek1 = dayDiff >= 0 && dayDiff < 7;

        assignedPerDate[dateStr] = new Set();
        fixedShiftsByDate[dateStr] = [];

        for (const emp of employees) {
            const avail = findAvailability(emp, dayOfWeek, isWeek1, weekStart);
            if (!avail || !avail.isAvailable || !avail.isFixed) continue;

            const empId = emp._id.toString();
            if (assignedPerDate[dateStr].has(empId)) continue;

            const rawMins = toMinutes(avail.endTime) - toMinutes(avail.startTime);
            if (rawMins <= 0) continue;

            const breakMins = rawMins >= 360 ? (emp.lunchBreakMinutes || 0) : 0;
            const shift = new Shift({
                employeeId: emp._id,
                date: dateStr,
                startTime: avail.startTime,
                endTime: avail.endTime,
                breakMinutes: breakMins,
                department,
                isFormation: emp.isFormation || false
            });
            await shift.save();
            generatedShifts.push(shift);

            assignedPerDate[dateStr].add(empId);
            fixedShiftsByDate[dateStr].push({ empId, isHeadCashier: !!emp.isHeadCashier, isFormation: !!emp.isFormation, startTime: avail.startTime, endTime: avail.endTime });

            weeklyHours[weekStart] = weeklyHours[weekStart] || {};
            const addedDur = computeShiftHours(avail.startTime, avail.endTime, emp);
            weeklyHours[weekStart][empId] = (weeklyHours[weekStart][empId] || 0) + addedDur;
            totalHours[empId] = (totalHours[empId] || 0) + addedDur;

            if (!emp.isFormation && isEveningShift(avail.endTime, dayOfWeek)) {
                eveningCounts[weekStart] = eveningCounts[weekStart] || {};
                eveningCounts[weekStart][empId] = (eveningCounts[weekStart][empId] || 0) + 1;
            }

            const dow = dateObj.getDay();
            if (!emp.isFormation && (dow === 6 || dow === 0)) {
                const satKey = getSaturdayKey(dateStr);
                if (!weekendWorkers.has(satKey)) weekendWorkers.set(satKey, new Set());
                weekendWorkers.get(satKey).add(empId);
            }
        }
    }

    for (const dateStr of dates) {
        const dateObj = parseDate(dateStr);
        const dayOfWeek = dateObj.getDay();
        const weekStart = getWeekStart(dateStr);
        const rule = specificRulesByWeekAndDay.get(`${weekStart}|${dayOfWeek}`) || genericRulesByDay.get(dayOfWeek);
        if (!rule || !rule.isOpen || !rule.requiredShifts || rule.requiredShifts.length === 0) continue;

        assignedPerDate[dateStr] = assignedPerDate[dateStr] || new Set();
        fixedShiftsByDate[dateStr] = fixedShiftsByDate[dateStr] || [];

        const dayDiff = Math.floor((dateObj - periodStart) / (1000 * 60 * 60 * 24));
        const isWeek1 = dayDiff >= 0 && dayDiff < 7;
        const isSaturday = dayOfWeek === 6;
        const isSunday = dayOfWeek === 0;

        let saturdayKey = null;
        let previousWorkers = null;
        let currentWorkers = null;
        let nextSundayContext = null;

        if (isSaturday || isSunday) {
            saturdayKey = getSaturdayKey(dateStr);
            previousWorkers = await loadWeekendWorkers(previousSaturday(saturdayKey));

            if (isSaturday) {
                if (!weekendWorkers.has(saturdayKey)) weekendWorkers.set(saturdayKey, new Set());
                currentWorkers = weekendWorkers.get(saturdayKey);

                const nextDateStr = addDaysToDateStr(dateStr, 1);
                const nextDateObj = parseDate(nextDateStr);
                const nextDayDiff = Math.floor((nextDateObj - periodStart) / (1000 * 60 * 60 * 24));
                const nextIsWeek1 = nextDayDiff >= 0 && nextDayDiff < 7;
                nextSundayContext = { dateStr: nextDateStr, isWeek1: nextIsWeek1 };
            } else {
                currentWorkers = weekendWorkers.has(saturdayKey)
                    ? weekendWorkers.get(saturdayKey)
                    : await loadWeekendWorkers(saturdayKey);
            }
        }

        // Construire la file des sous-créneaux du jour, triée par rareté
        // (moins de candidats = priorité) pour remplir d'abord les créneaux difficiles.
        let subSlotQueue = [];
        for (const slot of rule.requiredShifts) {
            const subSlots = [{ count: slot.count, startTime: slot.startTime, endTime: slot.endTime }];
            for (const subSlot of subSlots) {
                const fixedForDate = fixedShiftsByDate[dateStr] || [];
                const fixedCovering = fixedForDate.filter(f =>
                    !f.isHeadCashier &&
                    !f.isFormation &&
                    toMinutes(f.startTime) <= toMinutes(subSlot.startTime) &&
                    toMinutes(f.endTime) >= toMinutes(subSlot.endTime)
                ).length;
                const needed = Math.max(0, (subSlot.count || 1) - fixedCovering);
                if (needed <= 0) continue;

                const rarity = employees.filter(e => employeeCanCover(e, subSlot, dayOfWeek, isWeek1, weekStart, dateStr, assignedPerDate[dateStr])).length;
                subSlotQueue.push({
                    count: subSlot.count,
                    startTime: subSlot.startTime,
                    endTime: subSlot.endTime,
                    needed,
                    rarity,
                    duration: toMinutes(subSlot.endTime) - toMinutes(subSlot.startTime),
                    isEvening: isEveningShift(subSlot.endTime, dayOfWeek)
                });
            }
        }
        // On traite d'abord les quarts les plus rares (moins de candidats), mais entre
        // deux quarts à rareté égale, on traite les quarts NON-soir avant les quarts de
        // soir : sinon, comme le bloc du milieu (ex. 12h-21h) est souvent plus long que
        // le bloc du matin, il serait traité en premier et les employés les moins chargés
        // se retrouveraient systématiquement absorbés par les quarts de soir avant même
        // d'avoir eu la chance de prendre un quart de jour.
        subSlotQueue.sort((a, b) => (a.rarity - b.rarity) || (Number(a.isEvening) - Number(b.isEvening)) || (b.duration - a.duration));

        for (const subSlot of subSlotQueue) {
            // On s'assure que assignedPerDate reflète exactement les shifts déjà créés
            // pour cette journée, afin d'éviter toute double assignation.
            assignedPerDate[dateStr] = new Set(generatedShifts
                .filter(s => s.date === dateStr && !s.isFormation)
                .map(s => s.employeeId.toString()));

            // On essaie d'abord de combler le quart en gardant les employés proches de
            // leur cible (peu ou pas de dépassement), pour éviter les gros écarts
            // d'heures entre employés. On ne relâche la contrainte de dépassement que
            // si aucun candidat suffisamment disponible n'est trouvé, afin de garantir
            // que le quart soit tout de même comblé en dernier recours.
            const eligibleBase = employees.filter(e =>
                employeeCanCover(e, subSlot, dayOfWeek, isWeek1, weekStart, dateStr, assignedPerDate[dateStr])
            );

            const isEvening = isEveningShift(subSlot.endTime, dayOfWeek);
            // Pour un quart de soir, on essaie d'abord de ne piger que chez les employés
            // ayant moins de 2 soirs cette semaine, puis on relâche jusqu'à 3 (cas extrême),
            // et seulement en tout dernier recours au-delà (pour garantir que le quart soit
            // comblé). Cette contrainte est combinée avec le plafond de dépassement de cible.
            const eveningCapTiers = isEvening ? [2, 2, 2, 2, 3, Infinity] : [Infinity];
            const overageCaps = [1.2, 1.4, 1.8, 2.5, Infinity];

            let candidates = [];
            outerCapSearch:
            for (const eveningCap of eveningCapTiers) {
                for (const cap of overageCaps) {
                    candidates = eligibleBase.filter(e => {
                        const empId = e._id.toString();
                        const weeklyCurrent = (weeklyHours[weekStart] && weeklyHours[weekStart][empId]) || 0;
                        const weeklyTarget = getEffectiveWeeklyTarget(e);
                        const dur = computeShiftHours(subSlot.startTime, subSlot.endTime, e);
                        if (weeklyCurrent + dur > weeklyTarget * cap) return false;
                        if (isEvening) {
                            const evCount = (eveningCounts[weekStart] && eveningCounts[weekStart][empId]) || 0;
                            const evMax = getMaxEveningShifts(e);
                            if (evCount >= Math.min(eveningCap, evMax)) return false;
                        }
                        return true;
                    });
                    if (candidates.length >= subSlot.needed) break outerCapSearch;
                }
            }

            if (candidates.length < subSlot.needed) {
                warnings.push(`Pas assez d'employés disponibles le ${dateStr} pour ${subSlot.startTime}-${subSlot.endTime} (manque: ${subSlot.needed - candidates.length})`);
                continue;
            }

            const scored = candidates.map(e => {
                const empId = e._id.toString();
                // Utiliser les heures de la semaine courante pour l'équité, pas le total cumulé sur toutes les semaines
                const weeklyCurrent = (weeklyHours[weekStart] && weeklyHours[weekStart][empId]) || 0;
                const weeklyTarget = getEffectiveWeeklyTarget(e);
                const dur = computeShiftHours(subSlot.startTime, subSlot.endTime, e);
                const projectedWeekly = weeklyCurrent + dur;
                // Normaliser par la cible (ajustée par ancienneté) pour équilibrer les ratios d'heures
                const projectedRatio = projectedWeekly / weeklyTarget;
                const over = Math.max(0, projectedWeekly - weeklyTarget);
                const overRatio = over / weeklyTarget;
                // Plus le score est bas, meilleur est le candidat.
                // Critère principal : ratio des heures projetées par rapport à la cible effective (égalité relative,
                // mais moins stricte pour permettre une dispersion naturelle ~4h comme le planning de référence).
                // Pénalité quadratique sur le dépassement de cible, plus faible pour autoriser quelques heures d'écart.
                // Tie-break : ancienneté brute (départage fin entre employés à ratio quasi identique).
                let score = Math.pow(projectedRatio, 2) * 50 + Math.pow(overRatio * 100, 2) * 0.1 + (e.seniority || 10) * 5;

                // Bonus pour les employés plus anciens sur les quarts de jour, afin
                // d'éviter qu'ils se retrouvent avec uniquement des soirs.
                if (!isEvening) {
                    score -= (11 - (e.seniority || 10)) * 10;

                    // Privilégier fortement les employés qui ont peu ou pas de soirs
                    // restants cette semaine, afin de compenser avec des quarts de jour.
                    const evCount = (eveningCounts[weekStart] && eveningCounts[weekStart][empId]) || 0;
                    const evMax = getMaxEveningShifts(e);
                    score += Math.max(0, evMax - evCount) * 100;
                }

                // Pour un quart de soir, pénaliser fortement les employés qui ont déjà
                // plusieurs soirs cette semaine afin de répartir les soirs entre plus de
                // personnes (cible : 2 soirs/semaine, 3 seulement si nécessaire).
                if (isEvening) {
                    const evCount = (eveningCounts[weekStart] && eveningCounts[weekStart][empId]) || 0;
                    score += Math.pow(evCount, 2) * 50 + (11 - (e.seniority || 10)) * 10;
                }

                let isPreviousWeekendWorker = false;
                if (isSaturday) {
                    isPreviousWeekendWorker = !!(previousWorkers && previousWorkers.has(empId));
                    if (nextSundayContext) {
                        const nextAvail = findAvailability(e, 0, nextSundayContext.isWeek1, getWeekStart(nextSundayContext.dateStr));
                        const nextVacation = (e.vacations || []).some(v => nextSundayContext.dateStr >= v.startDate && nextSundayContext.dateStr <= v.endDate);
                        if (nextAvail && nextAvail.isAvailable && !nextVacation) score -= 5;
                    }
                } else if (isSunday) {
                    isPreviousWeekendWorker = !!(previousWorkers && previousWorkers.has(empId));
                    if (currentWorkers && currentWorkers.size > 0 && !currentWorkers.has(empId)) score += 100;
                }

                return { employee: e, score, isPreviousWeekendWorker };
            });

            // Priorité de rotation : sur samedi/dimanche, on préfère d'abord les employés qui
            // n'ont PAS travaillé la fin de semaine précédente. On ne pige dans le groupe
            // "a travaillé le week-end dernier" que si le groupe "frais" ne suffit pas à combler
            // les postes requis, afin d'éviter de faire travailler les mêmes personnes chaque fin
            // de semaine tant qu'une alternative existe.
            let orderedScored;
            if (isSaturday || isSunday) {
                const fresh = scored.filter(s => !s.isPreviousWeekendWorker).sort((a, b) => a.score - b.score);
                const repeat = scored.filter(s => s.isPreviousWeekendWorker).sort((a, b) => a.score - b.score);
                orderedScored = fresh.concat(repeat);
            } else {
                orderedScored = scored.sort((a, b) => a.score - b.score);
            }

            for (let i = 0; i < subSlot.needed; i++) {
                const candidate = orderedScored.find(s => !assignedPerDate[dateStr].has(s.employee._id.toString()));
                if (!candidate) break;
                const emp = candidate.employee;
                const empId = emp._id.toString();

                const rawMins = toMinutes(subSlot.endTime) - toMinutes(subSlot.startTime);
                const breakMins = rawMins >= 360 ? (emp.lunchBreakMinutes || 0) : 0;

                const shift = new Shift({
                    employeeId: emp._id,
                    date: dateStr,
                    startTime: subSlot.startTime,
                    endTime: subSlot.endTime,
                    breakMinutes: breakMins,
                    department,
                    isFormation: emp.isFormation || false
                });
                await shift.save();
                generatedShifts.push(shift);

                assignedPerDate[dateStr].add(empId);
                const addedDur = computeShiftHours(subSlot.startTime, subSlot.endTime, emp);
                weeklyHours[weekStart] = weeklyHours[weekStart] || {};
                weeklyHours[weekStart][empId] = (weeklyHours[weekStart][empId] || 0) + addedDur;
                // totalHours est maintenant basé sur les heures de la semaine courante pour l'équité
                totalHours[empId] = weeklyHours[weekStart][empId];

                if (isEvening) {
                    eveningCounts[weekStart] = eveningCounts[weekStart] || {};
                    eveningCounts[weekStart][empId] = (eveningCounts[weekStart][empId] || 0) + 1;
                }

                if (currentWorkers) {
                    currentWorkers.add(empId);
                    weekendWorkers.set(saturdayKey, currentWorkers);
                }
            }
        }
    }

    // Passe d'équilibrage : les règles de rotation de fin de semaine et l'ordre de
    // remplissage jour par jour peuvent laisser un écart important entre l'employé
    // qui a reçu le plus d'heures et celui qui en a reçu le moins, même si la cible
    // est la même pour tous. On tente ici d'échanger des quarts entre l'employé le
    // plus chargé et le moins chargé (en respectant les disponibilités de chacun)
    // pour resserrer cet écart autant que possible.
    function isActiveThisWeek(emp, weekStartStr) {
        for (let d = 0; d < 7; d++) {
            const dateStr = addDaysToDateStr(weekStartStr, d);
            if ((emp.vacations || []).some(v => dateStr >= v.startDate && dateStr <= v.endDate)) continue;
            const dateObj = parseDate(dateStr);
            const dayOfWeek = dateObj.getDay();
            const dayDiff = Math.floor((dateObj - periodStart) / (1000 * 60 * 60 * 24));
            const isWeek1Local = dayDiff >= 0 && dayDiff < 7;
            const avail = findAvailability(emp, dayOfWeek, isWeek1Local, weekStartStr);
            if (avail && avail.isAvailable) return true;
        }
        return false;
    }

    const allActiveEmployees = employees.filter(e => !e.isFormation && !e.isHeadCashier);

    for (const weekStart of weeks) {
        const weekEnd = addDaysToDateStr(weekStart, 6);
        const maxIterations = 100;
        const activeEmployees = allActiveEmployees.filter(e => isActiveThisWeek(e, weekStart));

        const trySwapPair = async (most, least) => {
            const candidateShifts = generatedShifts.filter(s =>
                !s.isFormation &&
                s.employeeId.toString() === most.empId &&
                s.date >= weekStart && s.date <= weekEnd &&
                s.date >= startDate && s.date <= endDate
            );

            const canTake = (emp, empId, shift, excludeDate) => {
                if (assignedPerDate[shift.date] && assignedPerDate[shift.date].has(empId) && shift.date !== excludeDate) return null;
                if ((emp.vacations || []).some(v => shift.date >= v.startDate && shift.date <= v.endDate)) return null;
                const dateObj = parseDate(shift.date);
                const dayOfWeek = dateObj.getDay();
                const dayDiff = Math.floor((dateObj - periodStart) / (1000 * 60 * 60 * 24));
                const isWeek1Local = dayDiff >= 0 && dayDiff < 7;
                const avail = findAvailability(emp, dayOfWeek, isWeek1Local, weekStart);
                if (!avail || !avail.isAvailable) return null;
                if (avail.isFixed) {
                    if (avail.startTime !== shift.startTime || avail.endTime !== shift.endTime) return null;
                } else if (!(toMinutes(avail.startTime) <= toMinutes(shift.startTime) && toMinutes(avail.endTime) >= toMinutes(shift.endTime))) {
                    return null;
                }
                // Ne pas faire dépasser le plafond exceptionnel de 3 soirs/semaine lors
                // d'un échange (sauf si l'employé a déjà ce quart, i.e. excludeDate).
                if (isEveningShiftForDate(shift.endTime, shift.date) && shift.date !== excludeDate) {
                    const evCount = (eveningCounts[weekStart] && eveningCounts[weekStart][empId]) || 0;
                    if (evCount >= getMaxEveningShifts(emp)) return null;
                }
                return computeShiftHours(shift.startTime, shift.endTime, emp);
            };

            let swapped = false;

            // 1) Transfert direct : donner un quart de "most" à "least", si cela
            // réduit réellement l'écart entre les deux (on tolère un léger
            // dépassement, les quarts ayant une durée discrète).
            for (const shift of candidateShifts) {
                const dur = canTake(least.emp, least.empId, shift, null);
                if (dur === null) continue;
                const oldDur = computeShiftHours(shift.startTime, shift.endTime, most.emp);

                const oldGap = most.current - least.current;
                const newGap = Math.abs((most.current - oldDur) - (least.current + dur));
                if (newGap >= oldGap) continue;

                const rawMins = toMinutes(shift.endTime) - toMinutes(shift.startTime);
                shift.employeeId = least.emp._id;
                shift.breakMinutes = rawMins >= 360 ? (least.emp.lunchBreakMinutes || 0) : 0;
                await shift.save();

                assignedPerDate[shift.date].delete(most.empId);
                assignedPerDate[shift.date].add(least.empId);

                weeklyHours[weekStart][most.empId] = (weeklyHours[weekStart][most.empId] || 0) - oldDur;
                weeklyHours[weekStart][least.empId] = (weeklyHours[weekStart][least.empId] || 0) + dur;

                if (isEveningShiftForDate(shift.endTime, shift.date)) {
                    eveningCounts[weekStart] = eveningCounts[weekStart] || {};
                    eveningCounts[weekStart][most.empId] = Math.max(0, (eveningCounts[weekStart][most.empId] || 0) - 1);
                    eveningCounts[weekStart][least.empId] = (eveningCounts[weekStart][least.empId] || 0) + 1;
                }

                swapped = true;
                break;
            }

            // 2) Échange croisé : si aucun transfert direct n'améliore la situation
            // (un seul quart de "most" est souvent trop long pour être simplement
            // donné sans faire basculer le déséquilibre dans l'autre sens), on
            // essaie d'échanger un quart de "most" contre un quart de "least" sur
            // un autre jour, ce qui permet d'équilibrer des quarts de durées
            // différentes.
            if (!swapped) {
                const leastShifts = generatedShifts.filter(s =>
                    !s.isFormation &&
                    s.employeeId.toString() === least.empId &&
                    s.date >= weekStart && s.date <= weekEnd &&
                    s.date >= startDate && s.date <= endDate
                );

                outer:
                for (const shiftA of candidateShifts) {
                    for (const shiftB of leastShifts) {
                        // Un échange le même jour (chacun garde un seul quart, juste inversé)
                        // est permis : c'est simplement un échange de rôle ce jour-là.

                        const durAForLeast = canTake(least.emp, least.empId, shiftA, shiftB.date);
                        const durBForMost = canTake(most.emp, most.empId, shiftB, shiftA.date);
                        if (durAForLeast === null || durBForMost === null) continue;

                        const durAOld = computeShiftHours(shiftA.startTime, shiftA.endTime, most.emp);
                        const durBOld = computeShiftHours(shiftB.startTime, shiftB.endTime, least.emp);

                        const newMostHours = most.current - durAOld + durBForMost;
                        const newLeastHours = least.current - durBOld + durAForLeast;

                        const oldGap = most.current - least.current;
                        const newGap = Math.abs(newMostHours - newLeastHours);
                        if (newGap >= oldGap) continue;

                        const rawMinsA = toMinutes(shiftA.endTime) - toMinutes(shiftA.startTime);
                        const rawMinsB = toMinutes(shiftB.endTime) - toMinutes(shiftB.startTime);

                        shiftA.employeeId = least.emp._id;
                        shiftA.breakMinutes = rawMinsA >= 360 ? (least.emp.lunchBreakMinutes || 0) : 0;
                        shiftB.employeeId = most.emp._id;
                        shiftB.breakMinutes = rawMinsB >= 360 ? (most.emp.lunchBreakMinutes || 0) : 0;
                        await shiftA.save();
                        await shiftB.save();

                        assignedPerDate[shiftA.date].delete(most.empId);
                        assignedPerDate[shiftA.date].add(least.empId);
                        assignedPerDate[shiftB.date].delete(least.empId);
                        assignedPerDate[shiftB.date].add(most.empId);

                        weeklyHours[weekStart][most.empId] = newMostHours;
                        weeklyHours[weekStart][least.empId] = newLeastHours;

                        eveningCounts[weekStart] = eveningCounts[weekStart] || {};
                        if (isEveningShiftForDate(shiftA.endTime, shiftA.date)) {
                            eveningCounts[weekStart][most.empId] = Math.max(0, (eveningCounts[weekStart][most.empId] || 0) - 1);
                            eveningCounts[weekStart][least.empId] = (eveningCounts[weekStart][least.empId] || 0) + 1;
                        }
                        if (isEveningShiftForDate(shiftB.endTime, shiftB.date)) {
                            eveningCounts[weekStart][least.empId] = Math.max(0, (eveningCounts[weekStart][least.empId] || 0) - 1);
                            eveningCounts[weekStart][most.empId] = (eveningCounts[weekStart][most.empId] || 0) + 1;
                        }

                        swapped = true;
                        break outer;
                    }
                }
            }

            return swapped;
        };

        for (let iter = 0; iter < maxIterations; iter++) {
            weeklyHours[weekStart] = weeklyHours[weekStart] || {};
            const ratios = activeEmployees.map(e => {
                const empId = e._id.toString();
                const target = getEffectiveWeeklyTarget(e);
                const current = weeklyHours[weekStart][empId] || 0;
                return { emp: e, empId, current, target, ratio: current / target };
            });
            if (ratios.length < 2) break;

            ratios.sort((a, b) => b.ratio - a.ratio);

            if (ratios[0].current - ratios[ratios.length - 1].current <= 4 || ratios[0].ratio - ratios[ratios.length - 1].ratio <= 0.2) break;

            // On tente d'abord la paire la plus déséquilibrée (le plus chargé contre le
            // moins chargé), mais si aucune disponibilité compatible n'existe entre ces
            // deux personnes précises, on essaie les paires suivantes par ordre d'écart
            // décroissant avant d'abandonner complètement cette semaine.
            const pairs = [];
            for (let i = 0; i < ratios.length; i++) {
                for (let j = ratios.length - 1; j > i; j--) {
                    const gap = ratios[i].current - ratios[j].current;
                    if (gap <= 4) continue;
                    pairs.push({ most: ratios[i], least: ratios[j], gap });
                }
            }
            pairs.sort((a, b) => b.gap - a.gap);

            let swapped = false;
            for (const pair of pairs) {
                if (await trySwapPair(pair.most, pair.least)) {
                    swapped = true;
                    break;
                }
            }

            if (!swapped) break;
        }

        // Passe de diversification des soirs : l'équilibrage des heures ci-dessus peut
        // quand même laisser un employé avec UNIQUEMENT des quarts de soir (aucun quart
        // de jour), notamment quand ses disponibilités le rendent candidat aux blocs de
        // soir dès le début de la semaine. On tente alors d'échanger un de ses quarts de
        // soir contre un quart de jour d'un autre employé actif, en tolérant un léger
        // écart d'heures pour ne pas défaire l'équilibrage précédent.
        for (let iter = 0; iter < 20; iter++) {
            eveningCounts[weekStart] = eveningCounts[weekStart] || {};
            weeklyHours[weekStart] = weeklyHours[weekStart] || {};

            const shiftsForEmp = (empId) => generatedShifts.filter(s =>
                !s.isFormation &&
                s.employeeId.toString() === empId &&
                s.date >= weekStart && s.date <= weekEnd &&
                s.date >= startDate && s.date <= endDate
            );

            const stats = activeEmployees.map(e => {
                const empId = e._id.toString();
                const empShifts = shiftsForEmp(empId);
                const evCount = eveningCounts[weekStart][empId] || 0;
                const dayCount = empShifts.length - evCount;
                return { emp: e, empId, evCount, dayCount, totalShifts: empShifts.length };
            });

            const monopolized = stats
                .filter(s => s.totalShifts >= 2 && s.dayCount === 0)
                .sort((a, b) => b.evCount - a.evCount);
            if (monopolized.length === 0) break;

            const donors = stats
                .filter(s => s.dayCount >= 1)
                .sort((a, b) => a.evCount - b.evCount);

            const canSwapShift = (emp, empId, shift, excludeDate) => {
                if (assignedPerDate[shift.date] && assignedPerDate[shift.date].has(empId) && shift.date !== excludeDate) return null;
                if ((emp.vacations || []).some(v => shift.date >= v.startDate && shift.date <= v.endDate)) return null;
                const dateObj = parseDate(shift.date);
                const dayOfWeek = dateObj.getDay();
                const dayDiff = Math.floor((dateObj - periodStart) / (1000 * 60 * 60 * 24));
                const isWeek1Local = dayDiff >= 0 && dayDiff < 7;
                const avail = findAvailability(emp, dayOfWeek, isWeek1Local, weekStart);
                if (!avail || !avail.isAvailable) return null;
                if (avail.isFixed) {
                    if (avail.startTime !== shift.startTime || avail.endTime !== shift.endTime) return null;
                } else if (!(toMinutes(avail.startTime) <= toMinutes(shift.startTime) && toMinutes(avail.endTime) >= toMinutes(shift.endTime))) {
                    return null;
                }
                return computeShiftHours(shift.startTime, shift.endTime, emp);
            };

            let swapped = false;
            outerDiversify:
            for (const most of monopolized) {
                const mostEveningShifts = shiftsForEmp(most.empId).filter(s => isEveningShiftForDate(s.endTime, s.date));

                for (const least of donors) {
                    if (least.empId === most.empId) continue;

                    const leastEvCount = eveningCounts[weekStart][least.empId] || 0;
                    if (leastEvCount >= getMaxEveningShifts(least.emp)) continue;

                    const leastDayShifts = shiftsForEmp(least.empId).filter(s => !isEveningShiftForDate(s.endTime, s.date));

                    for (const shiftA of mostEveningShifts) {
                        for (const shiftB of leastDayShifts) {
                            const durAForLeast = canSwapShift(least.emp, least.empId, shiftA, shiftB.date);
                            const durBForMost = canSwapShift(most.emp, most.empId, shiftB, shiftA.date);
                            if (durAForLeast === null || durBForMost === null) continue;

                            const durAOld = computeShiftHours(shiftA.startTime, shiftA.endTime, most.emp);
                            const durBOld = computeShiftHours(shiftB.startTime, shiftB.endTime, least.emp);

                            const mostCurrent = weeklyHours[weekStart][most.empId] || 0;
                            const leastCurrent = weeklyHours[weekStart][least.empId] || 0;
                            const newMostHours = mostCurrent - durAOld + durBForMost;
                            const newLeastHours = leastCurrent - durBOld + durAForLeast;

                            // On tolère un léger déséquilibre d'heures pour permettre la
                            // diversification, mais on évite de créer un écart flagrant.
                            if (Math.abs(newMostHours - newLeastHours) > 6) continue;

                            const rawMinsA = toMinutes(shiftA.endTime) - toMinutes(shiftA.startTime);
                            const rawMinsB = toMinutes(shiftB.endTime) - toMinutes(shiftB.startTime);

                            shiftA.employeeId = least.emp._id;
                            shiftA.breakMinutes = rawMinsA >= 360 ? (least.emp.lunchBreakMinutes || 0) : 0;
                            shiftB.employeeId = most.emp._id;
                            shiftB.breakMinutes = rawMinsB >= 360 ? (most.emp.lunchBreakMinutes || 0) : 0;
                            await shiftA.save();
                            await shiftB.save();

                            assignedPerDate[shiftA.date].delete(most.empId);
                            assignedPerDate[shiftA.date].add(least.empId);
                            assignedPerDate[shiftB.date].delete(least.empId);
                            assignedPerDate[shiftB.date].add(most.empId);

                            weeklyHours[weekStart][most.empId] = newMostHours;
                            weeklyHours[weekStart][least.empId] = newLeastHours;

                            eveningCounts[weekStart][most.empId] = Math.max(0, (eveningCounts[weekStart][most.empId] || 0) - 1);
                            eveningCounts[weekStart][least.empId] = (eveningCounts[weekStart][least.empId] || 0) + 1;

                            swapped = true;
                            break outerDiversify;
                        }
                    }
                }
            }

            if (!swapped) break;
        }

        // Passe finale d'ajustement par ancienneté : on accepte qu'un employé plus
        // ancien ait légèrement plus d'heures qu'un moins ancien, mais on refuse
        // l'inverse. Si un senior a moins d'heures qu'un junior, on cherche à échanger
        // un quart plus court du senior contre un quart plus long du junior, ce qui
        // redonne au senior sa place en haut de la distribution sans ajouter de quart.
        const canSwap = (emp, empId, shift, excludeDate) => {
            if (assignedPerDate[shift.date] && assignedPerDate[shift.date].has(empId) && shift.date !== excludeDate) return null;
            if ((emp.vacations || []).some(v => shift.date >= v.startDate && shift.date <= v.endDate)) return null;
            const dateObj = parseDate(shift.date);
            const dayOfWeek = dateObj.getDay();
            const dayDiff = Math.floor((dateObj - periodStart) / (1000 * 60 * 60 * 24));
            const isWeek1Local = dayDiff >= 0 && dayDiff < 7;
            const avail = findAvailability(emp, dayOfWeek, isWeek1Local, weekStart);
            if (!avail || !avail.isAvailable) return null;
            if (avail.isFixed) {
                if (avail.startTime !== shift.startTime || avail.endTime !== shift.endTime) return null;
            } else if (!(toMinutes(avail.startTime) <= toMinutes(shift.startTime) && toMinutes(avail.endTime) >= toMinutes(shift.endTime))) {
                return null;
            }
            if (isEveningShiftForDate(shift.endTime, shift.date) && shift.date !== excludeDate) {
                const evCount = (eveningCounts[weekStart] && eveningCounts[weekStart][empId]) || 0;
                if (evCount >= getMaxEveningShifts(emp)) return null;
            }
            return computeShiftHours(shift.startTime, shift.endTime, emp);
        };

        const seniorityBoost = async (senior, junior) => {
            if (junior.current <= senior.current) return false;

            const seniorShifts = generatedShifts.filter(s =>
                !s.isFormation &&
                s.employeeId.toString() === senior.empId &&
                s.date >= weekStart && s.date <= weekEnd &&
                s.date >= startDate && s.date <= endDate
            );
            const juniorShifts = generatedShifts.filter(s =>
                !s.isFormation &&
                s.employeeId.toString() === junior.empId &&
                s.date >= weekStart && s.date <= weekEnd &&
                s.date >= startDate && s.date <= endDate
            );

            for (const shiftS of seniorShifts) {
                for (const shiftJ of juniorShifts) {
                    const durJForSenior = canSwap(senior.emp, senior.empId, shiftJ, shiftS.date);
                    const durSForJunior = canSwap(junior.emp, junior.empId, shiftS, shiftJ.date);
                    if (durJForSenior === null || durSForJunior === null) continue;

                    const durSOld = computeShiftHours(shiftS.startTime, shiftS.endTime, senior.emp);
                    const durJOld = computeShiftHours(shiftJ.startTime, shiftJ.endTime, junior.emp);

                    const newSeniorHours = senior.current - durSOld + durJForSenior;
                    const newJuniorHours = junior.current - durJOld + durSForJunior;

                    // On accepte que le senior dépasse le junior, mais pas trop.
                    if (newSeniorHours < newJuniorHours || newSeniorHours - newJuniorHours > 3) continue;

                    // On refuse d'augmenter le nombre de soirs du senior : on privilégie
                    // un échange de même type (jour contre jour ou soir contre soir), ou
                    // un échange qui réduit les soirs du senior.
                    const isEveningS = isEveningShiftForDate(shiftS.endTime, shiftS.date);
                    const isEveningJ = isEveningShiftForDate(shiftJ.endTime, shiftJ.date);
                    const currentSeniorEvenings = (eveningCounts[weekStart] && eveningCounts[weekStart][senior.empId]) || 0;
                    const newSeniorEvenings = currentSeniorEvenings + (isEveningJ ? 1 : 0) - (isEveningS ? 1 : 0);
                    if (newSeniorEvenings > getMaxEveningShifts(senior.emp)) continue;

                    const rawMinsS = toMinutes(shiftS.endTime) - toMinutes(shiftS.startTime);
                    const rawMinsJ = toMinutes(shiftJ.endTime) - toMinutes(shiftJ.startTime);

                    shiftS.employeeId = junior.emp._id;
                    shiftS.breakMinutes = rawMinsS >= 360 ? (junior.emp.lunchBreakMinutes || 0) : 0;
                    shiftJ.employeeId = senior.emp._id;
                    shiftJ.breakMinutes = rawMinsJ >= 360 ? (senior.emp.lunchBreakMinutes || 0) : 0;
                    await shiftS.save();
                    await shiftJ.save();

                    assignedPerDate[shiftS.date].delete(senior.empId);
                    assignedPerDate[shiftS.date].add(junior.empId);
                    assignedPerDate[shiftJ.date].delete(junior.empId);
                    assignedPerDate[shiftJ.date].add(senior.empId);

                    weeklyHours[weekStart][senior.empId] = newSeniorHours;
                    weeklyHours[weekStart][junior.empId] = newJuniorHours;

                    if (isEveningShiftForDate(shiftS.endTime, shiftS.date)) {
                        eveningCounts[weekStart][senior.empId] = Math.max(0, (eveningCounts[weekStart][senior.empId] || 0) - 1);
                        eveningCounts[weekStart][junior.empId] = (eveningCounts[weekStart][junior.empId] || 0) + 1;
                    }
                    if (isEveningShiftForDate(shiftJ.endTime, shiftJ.date)) {
                        eveningCounts[weekStart][junior.empId] = Math.max(0, (eveningCounts[weekStart][junior.empId] || 0) - 1);
                        eveningCounts[weekStart][senior.empId] = (eveningCounts[weekStart][senior.empId] || 0) + 1;
                    }

                    return true;
                }
            }
            return false;
        };

        for (let iter = 0; iter < 20; iter++) {
            weeklyHours[weekStart] = weeklyHours[weekStart] || {};
            let boosted = false;

            const bySeniority = activeEmployees
                .map(e => {
                    const empId = e._id.toString();
                    return { emp: e, empId, current: weeklyHours[weekStart][empId] || 0 };
                })
                .sort((a, b) => (a.emp.seniority || 10) - (b.emp.seniority || 10));

            for (let i = 0; i < bySeniority.length; i++) {
                const senior = bySeniority[i];
                for (let j = bySeniority.length - 1; j > i; j--) {
                    const junior = bySeniority[j];
                    if (senior.current >= junior.current) continue;
                    if (await seniorityBoost(senior, junior)) {
                        boosted = true;
                        break;
                    }
                }
                if (boosted) break;
            }

            if (!boosted) break;
        }
    }

    return { generatedShifts, warnings };
}

module.exports = {
    generateSchedule,
    findAvailability,
    employeeCoversShift,
    getOverlap
};
