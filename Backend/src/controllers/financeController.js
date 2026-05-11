// src/controllers/financeController.js
// SRP: only handles HTTP request/response. All logic is in FinanceService.

const FinanceService = require('../services/FinanceService');

const handle = (fn) => async (req, res, next) => { try { return res.json(await fn(req)); } catch (e) { next(e); } };

const submitExpense      = handle(req => FinanceService.submitExpense(req.body));
const getMyExpenses      = handle(req => FinanceService.getMyExpenses(parseInt(req.params.emp_id)));
const getPendingExpenses = handle(req => FinanceService.getPendingExpenses(parseInt(req.params.manager_id)));
const resolveExpense     = handle(req => FinanceService.resolveExpense(req.body.ticket_id, req.body.action));

module.exports = { submitExpense, getMyExpenses, getPendingExpenses, resolveExpense };
