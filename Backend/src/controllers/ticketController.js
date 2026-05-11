// src/controllers/ticketController.js
// SRP: only handles HTTP request/response. All logic is in TicketService.

const TicketService = require('../services/TicketService');

const handle = (fn) => async (req, res, next) => { try { return res.json(await fn(req)); } catch (e) { next(e); } };

const getMyTickets          = handle(req => TicketService.getMyTickets(parseInt(req.params.emp_id)));
const deleteMyTicket        = handle(req => TicketService.deleteMyTicket(
    parseInt(req.params.ticket_id), parseInt(req.params.emp_id)
));
const requestTicketDeletion = handle(req => TicketService.requestTicketDeletion(
    parseInt(req.params.ticket_id), req.body.it_emp_id, req.body.reason
));
const submitAdminTicket     = handle(req => TicketService.submitAdminTicket(req.body));

module.exports = { getMyTickets, deleteMyTicket, requestTicketDeletion, submitAdminTicket };
