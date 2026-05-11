// src/routes/prRoutes.js
const express = require('express');
const router  = express.Router();
const {
    submitCampaign, getMyCampaigns, getPendingCampaigns,
    resolveCampaign, submitPressRelease, getPressReleases,
} = require('../controllers/prController');

router.post('/campaign',                          submitCampaign);
router.get('/my-campaigns/:emp_id',               getMyCampaigns);
router.get('/pending-campaigns/:manager_id',      getPendingCampaigns);
router.post('/resolve-campaign',                  resolveCampaign);
router.post('/press-release',                     submitPressRelease);
router.get('/press-releases/:manager_id',         getPressReleases);

module.exports = router;
