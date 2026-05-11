// src/controllers/hrController.js
// SRP: only handles HTTP request/response. All logic is in HRService.

const HRService          = require('../services/HRService');
const EmployeeRepository = require('../repositories/EmployeeRepository');

const handle = (fn) => async (req, res, next) => { try { return res.json(await fn(req)); } catch (e) { next(e); } };

const stageSalaryAdjustment = handle(req => HRService.stageSalaryAdjustment(req.body));
const getBranchEmployees    = handle(req => EmployeeRepository.findByBranch(req.query.branch_id));
const submitLeaveRequest    = handle(req => HRService.submitLeaveRequest(req.body));
const getPendingLeaves      = handle(req => HRService.getPendingLeaves(parseInt(req.params.hr_manager_id)));
const resolveLeave          = handle(req => HRService.resolveLeave(req.body.ticket_id, req.body.action));

module.exports = {
    stageSalaryAdjustment,
    getBranchEmployees,
    submitLeaveRequest,
    getPendingLeaves,
    resolveLeave,
};
