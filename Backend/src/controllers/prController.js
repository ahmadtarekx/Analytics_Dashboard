// src/controllers/prController.js
// SRP: only handles HTTP request/response. All logic is in PRService.

const PRService = require('../services/PRService');

const handle = (fn) => async (req, res, next) => { try { return res.json(await fn(req)); } catch (e) { next(e); } };

const submitCampaign      = handle(req => PRService.submitCampaign(req.body));
const getMyCampaigns      = handle(req => PRService.getMyCampaigns(parseInt(req.params.emp_id)));
const getPendingCampaigns = handle(req => PRService.getPendingCampaigns(parseInt(req.params.manager_id)));
const resolveCampaign     = handle(req => PRService.resolveCampaign(req.body.ticket_id));
const submitPressRelease  = handle(req => PRService.submitPressRelease(req.body));
const getPressReleases    = handle(req => PRService.getPressReleases(parseInt(req.params.manager_id)));

module.exports = {
    submitCampaign, getMyCampaigns, getPendingCampaigns,
    resolveCampaign, submitPressRelease, getPressReleases,
};
