// src/routes/aiRoutes.js
const express = require('express');
const router  = express.Router();
const { generateInsight, chat } = require('../controllers/aiController');

router.post('/insight', generateInsight);
router.post('/chat',    chat);

module.exports = router;
