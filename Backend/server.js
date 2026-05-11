require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// ─── Mount all routes ─────────────────────────────────────────────────────────
const routes = require('./src/routes/index');
app.use('/api', routes);

// ─── Global error handler ─────────────────────────────────────────────────────
const { errorHandler } = require('./src/middleware/errorHandler');
app.use(errorHandler);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 DashAnalyzer Server running on port ${PORT}`);
});
