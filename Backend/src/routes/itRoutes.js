// src/routes/itRoutes.js
const express = require('express');
const router  = express.Router();
const {
    sendTicket, getEmployee, stageInfoUpdate, stageEmailUpdate,
    resetPassword, stageBranchUpdate, getBranches, getTicketsInbox, replyTicket,
} = require('../controllers/itController');

router.post('/send-ticket',              sendTicket);
router.get('/employee/:id',              getEmployee);
router.patch('/employee/:id/info',       stageInfoUpdate);
router.patch('/employee/:id/email',      stageEmailUpdate);
router.post('/employee/:id/reset-password', resetPassword);
router.patch('/employee/:id/branch',     stageBranchUpdate);
router.get('/branches',                  getBranches);
router.get('/tickets',                   getTicketsInbox);
router.post('/reply-ticket',             replyTicket);

module.exports = router;
