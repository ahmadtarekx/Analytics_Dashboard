// src/controllers/aiController.js
// SRP: only handles HTTP request/response. All AI logic is in aiService.
// Note: the chat handler uses manual try/catch instead of the `handle` wrapper
// because AI rate-limit errors require domain-specific 429 response codes that
// the global error handler does not distinguish.

const aiService = require('../services/aiService');

// ─── POST /api/insight ────────────────────────────────────────────────────────
async function generateInsight(req, res, next) {
    try {
        if (!req.body.dashboardData)
            return res.status(400).json({ error: 'Missing dashboardData in request body.' });
        const insight = await aiService.generateStrategicInsight(req.body.dashboardData);
        return res.json({ insight });
    } catch (err) { next(err); }
}

// ─── POST /api/chat ───────────────────────────────────────────────────────────
// Requires bespoke 429 handling to surface daily-quota vs rate-limit distinctions to the client.
async function chat(req, res, next) {
    try {
        const { message, history, insight, role, department, replyLang } = req.body;
        if (!message || typeof message !== 'string' || !message.trim())
            return res.status(400).json({ error: 'Message is required.' });

        const reply = await aiService.generateChatReply(
            message.trim(),
            history    || [],
            insight    || null,
            role       || 'مدير',
            department || 'الشركة',
            replyLang  || null
        );
        return res.json({ reply });
    } catch (err) {
        const msg          = (err?.message || '').toLowerCase();
        const isDailyQuota = msg.includes('tokens per day') || msg.includes('tpd') || msg.includes('daily');
        const isRateLimit  = msg.includes('rate limit') || msg.includes('too many requests');

        if (isDailyQuota) return res.status(429).json({ error: 'daily_quota' });
        if (isRateLimit)  return res.status(429).json({ error: 'rate_limit' });
        next(err);
    }
}

module.exports = { generateInsight, chat };
