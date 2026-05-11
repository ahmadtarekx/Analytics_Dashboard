// src/controllers/dashboardController.js
// SRP: delegates entirely to DashboardService.

const DashboardService = require('../services/DashboardService');

async function getDashboard(req, res, next) {
    try {
        const { userId, role, departmentId, ...filters } = req.query;
        const data = await DashboardService.getData({ userId, role, departmentId, filters });
        return res.json(data);
    } catch (err) { next(err); }
}

module.exports = { getDashboard };
