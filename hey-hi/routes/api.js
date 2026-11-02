const express = require('express');
const router = express.Router();

const employeeRoutes = require('./employees');
const shiftRoutes = require('./shifts');
const shiftRulesRoutes = require('./shiftRules');
const scheduleRoutes = require('./schedule');

router.use('/employees', employeeRoutes);
router.use('/shifts', shiftRoutes);
router.use('/shift-rules', shiftRulesRoutes);
router.use('/schedule', scheduleRoutes);

module.exports = router;
