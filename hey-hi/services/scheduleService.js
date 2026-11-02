const { DEFAULT_RULES, ensureDefaultRules } = require('./scheduleRules');
const { generateSchedule } = require('./schedulingAlgorithm');

module.exports = {
    DEFAULT_RULES,
    ensureDefaultRules,
    generateSchedule
};
