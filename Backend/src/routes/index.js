// src/routes/index.js
// Central router: mounts all domain-specific routers under /api/*
// Implements: Open/Closed Principle — add new domains without touching existing routes

const express  = require('express');
const router   = express.Router();

router.use('/',          require('./authRoutes'));
router.use('/dashboard', require('./dashboardRoutes'));
router.use('/it',        require('./itRoutes'));
router.use('/manager',   require('./managerRoutes'));
router.use('/hr',        require('./hrRoutes'));
router.use('/sales',     require('./salesRoutes'));
router.use('/finance',   require('./financeRoutes'));
router.use('/pr',        require('./prRoutes'));
router.use('/products',  require('./productRoutes'));
router.use('/tickets',   require('./ticketRoutes'));
router.use('/',          require('./aiRoutes'));
router.use('/',          require('./translateRoutes'));

module.exports = router;