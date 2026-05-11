// src/routes/hrRoutes.js
const express = require('express');
const router  = express.Router();
const {
    stageSalaryAdjustment,
    getBranchEmployees,
    submitLeaveRequest,
    getPendingLeaves,
    resolveLeave,
} = require('../controllers/hrController');

router.post('/salary-adjustment',            stageSalaryAdjustment);
router.get('/branch-employees',              getBranchEmployees);
router.post('/leave-request',                submitLeaveRequest);
router.get('/pending-leaves/:hr_manager_id', getPendingLeaves);
router.post('/resolve-leave',                resolveLeave);

module.exports = router;
