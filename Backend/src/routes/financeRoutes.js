// src/routes/financeRoutes.js
const express = require('express');
const router  = express.Router();
const { submitExpense, getMyExpenses, getPendingExpenses, resolveExpense } = require('../controllers/financeController');

router.post('/expense',                        submitExpense);
router.get('/my-expenses/:emp_id',             getMyExpenses);
router.get('/pending-expenses/:manager_id',    getPendingExpenses);
router.post('/resolve-expense',                resolveExpense);

module.exports = router;
