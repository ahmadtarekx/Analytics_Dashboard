// src/controllers/salesController.js
// SRP: only handles HTTP request/response. All logic is in SalesService.

const SalesService = require('../services/SalesService');

const handle = (fn) => async (req, res, next) => { try { return res.json(await fn(req)); } catch (e) { next(e); } };

const getMyFullStats   = handle(req => SalesService.getMyFullStats(parseInt(req.params.emp_id)));
const getMyStats       = handle(req => SalesService.getMyStats(parseInt(req.params.emp_id)));
const getLeaderboard   = handle(req => SalesService.getLeaderboard(req.query.branch_id, req.query.period));
const getBranchSummary = handle(req => SalesService.getBranchSummary(
    req.query.branch_id, req.query.period, req.query.role
));
const getPendingLeaves = handle(req => SalesService.getPendingLeaves(parseInt(req.params.manager_id)));
const resolveLeave     = handle(req => SalesService.resolveLeave(req.body.ticket_id, req.body.action));

module.exports = { getMyFullStats, getMyStats, getLeaderboard, getBranchSummary, getPendingLeaves, resolveLeave };
