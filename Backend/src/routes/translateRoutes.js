// src/routes/translateRoutes.js
const express = require('express');
const router  = express.Router();

// POST /api/translate
// Body: { text: string, to: 'ar' | 'en' }
// Returns: { translated: string }
router.post('/translate', async (req, res) => {
    const { text, to } = req.body;

    if (!text || typeof text !== 'string' || !text.trim()) {
        return res.json({ translated: text || '' });
    }
    if (!['ar', 'en'].includes(to)) {
        return res.status(400).json({ error: 'Invalid target language. Use "ar" or "en".' });
    }

    try {
        const { translate } = await import('@vitalets/google-translate-api');
        const result = await translate(text.trim(), { to });
        res.json({ translated: result.text });
    } catch (err) {
        console.error('❌ [Translate]', err.message);
        // Return original text on failure so the UI degrades gracefully
        res.json({ translated: text, error: err.message });
    }
});

module.exports = router;
