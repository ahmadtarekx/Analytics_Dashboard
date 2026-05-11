// src/routes/managerRoutes.js
const express = require('express');
const router  = express.Router();
const { searchEmployee, getEmployeeStats, getApprovals, resolveApproval } = require('../controllers/managerController');

router.get('/employee-search',    searchEmployee);
router.get('/employee-stats',     getEmployeeStats);
router.get('/approvals/:id',      getApprovals);
router.post('/resolve',           resolveApproval);

module.exports = router;
