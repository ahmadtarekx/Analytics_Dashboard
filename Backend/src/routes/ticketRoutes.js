// src/routes/ticketRoutes.js
const express = require('express');
const router  = express.Router();
const { getMyTickets, deleteMyTicket, requestTicketDeletion, submitAdminTicket } = require('../controllers/ticketController');

router.get('/my/:emp_id',                              getMyTickets);
router.delete('/:ticket_id/employee/:emp_id',          deleteMyTicket);
router.post('/:ticket_id/request-delete',              requestTicketDeletion);
router.post('/create',                                 submitAdminTicket);


module.exports = router;
