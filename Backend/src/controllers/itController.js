// src/controllers/itController.js
const ITService = require('../services/ITService');
const EmployeeRepository = require('../repositories/EmployeeRepository');

const handle = (fn) => async (req, res, next) => { try { return res.json(await fn(req, res)); } catch (e) { next(e); } };

const sendTicket    = handle(req => ITService.sendTicket(req.body));
const getEmployee   = handle(req => ITService.getEmployee(req.params.id));
const getBranches   = handle(()  => EmployeeRepository.findAllBranches());
const getTicketsInbox = handle(req => ITService.getTicketsInbox(req.query.period || 'daily'));
const replyTicket   = handle(req => ITService.replyTicket(req.body));
const resetPassword = handle(req => ITService.resetPassword(parseInt(req.params.id)));

const stageInfoUpdate = handle(req => ITService.stageInfoUpdate({
    empId: parseInt(req.params.id),
    submitterId: parseInt(req.body.submitted_by_id) || null,
    submitterName: req.body.submitted_by_name || 'Admin',
    ...req.body,
}));

const stageEmailUpdate = handle(req => ITService.stageEmailUpdate({
    empId: parseInt(req.params.id),
    submitterId: parseInt(req.body.submitted_by_id) || null,
    submitterName: req.body.submitted_by_name || 'Admin',
    new_email: req.body.new_email,
}));

const stageBranchUpdate = handle(req => ITService.stageBranchUpdate({
    empId: parseInt(req.params.id),
    submitterId: parseInt(req.body.submitted_by_id) || null,
    submitterName: req.body.submitted_by_name || 'Admin',
    branch_id: req.body.branch_id,
    secondary_branch_id: req.body.secondary_branch_id,
}));

module.exports = { sendTicket, getEmployee, stageInfoUpdate, stageEmailUpdate, resetPassword, stageBranchUpdate, getBranches, getTicketsInbox, replyTicket };
