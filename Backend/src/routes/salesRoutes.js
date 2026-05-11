// src/routes/salesRoutes.js
const express = require('express');
const router  = express.Router();
const {
    getMyFullStats, getMyStats, getLeaderboard,
    getBranchSummary, getPendingLeaves, resolveLeave,
} = require('../controllers/salesController');

router.get('/my-full-stats/:emp_id',      getMyFullStats);
router.get('/my-stats/:emp_id',           getMyStats);
router.get('/leaderboard',                getLeaderboard);
router.get('/branch-summary',             getBranchSummary);
router.get('/pending-leaves/:manager_id', getPendingLeaves);
router.post('/resolve-leave',             resolveLeave);

module.exports = router;
