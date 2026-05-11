// src/controllers/managerController.js
// SRP: only handles HTTP request/response.
// - Employee search/stats → ManagerService
// - Approval workflow     → ApprovalService

const ManagerService  = require('../services/ManagerService');
const ApprovalService = require('../services/ApprovalService');

const handle = (fn) => async (req, res, next) => { try { return res.json(await fn(req)); } catch (e) { next(e); } };

const searchEmployee   = handle(req => ManagerService.searchEmployee(
    parseInt(req.query.manager_id), parseInt(req.query.emp_id)
));

const getEmployeeStats = handle(req => ManagerService.getEmployeeStats(
    parseInt(req.query.manager_id), parseInt(req.query.emp_id)
));

const getApprovals    = handle(req => ApprovalService.getApprovals(parseInt(req.params.id)));
const resolveApproval = handle(req => ApprovalService.resolveApproval(req.body.ticket_id, req.body.status));

module.exports = { searchEmployee, getEmployeeStats, getApprovals, resolveApproval };
