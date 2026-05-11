/**
 * ticketRepository.js — Repository Pattern
 * Talks to: /api/tickets/*
 */

import { apiClient, BASE_URL } from './apiClient';

const ENDPOINTS = {
  MY_TICKETS:     (empId)           => `${BASE_URL}/tickets/my/${empId}`,
  DELETE_TICKET:  (ticketId, empId) => `${BASE_URL}/tickets/${ticketId}/employee/${empId}`,
  REQUEST_DELETE: (ticketId)        => `${BASE_URL}/tickets/${ticketId}/request-delete`,
  CREATE:         `${BASE_URL}/tickets/create`,
};

const ticketRepository = {
  getMyTickets:         (empId)            => apiClient.get(ENDPOINTS.MY_TICKETS(empId)),
  deleteMyTicket:       (ticketId, empId)  => apiClient.delete(ENDPOINTS.DELETE_TICKET(ticketId, empId)),
  requestTicketDeletion:(ticketId, payload)=> apiClient.post(ENDPOINTS.REQUEST_DELETE(ticketId), payload),
  submitAdminTicket:    (payload)          => apiClient.post(ENDPOINTS.CREATE, payload),
};

export default ticketRepository;
