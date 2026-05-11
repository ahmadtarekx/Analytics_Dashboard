require('dotenv').config();
const prompts = require('./prompts');

// Error message catalog 
const AI_ERRORS = {
    insight: {
        no_api_key: 'AI engine unavailable: missing API credentials. Contact your system administrator.',
        rate_limit: 'The AI analysis engine is temporarily at capacity. Please wait a moment and retry.',
        daily_quota: 'The AI service has reached its daily usage limit. It will reset at midnight UTC.',
        overloaded: 'The AI service is temporarily overloaded. Please retry in a few seconds.',
        invalid_input: 'Strategic analysis could not be generated: the provided dataset is incomplete or malformed.',
        network: 'Unable to reach the AI analysis engine. Verify your network connection and retry.',
        default: 'Strategic insight generation failed due to an unexpected server-side error.',
    },
    chat: {
        no_api_key: 'AI advisor unavailable: missing API credentials. Contact your system administrator.',
        rate_limit: 'The AI advisor is temporarily at capacity. Please wait a moment before sending another message.',
        daily_quota: 'The AI assistant has reached its daily usage limit. It will reset at midnight UTC.',
        overloaded: 'The AI service is temporarily overloaded. Please retry in a few seconds.',
        invalid_input: 'Your message could not be processed. Please rephrase and try again.',
        network: 'Connection to the AI advisor was interrupted. Check your network and retry.',
        default: 'The AI advisor encountered an unexpected error. Please try again.',
    },
};

function classifyError(error, context) {
    const msg = (error?.message || '').toLowerCase();
    const status = error?.status || error?.statusCode;

    if (status === 401 || msg.includes('api key') || msg.includes('authentication') || msg.includes('unauthorized'))
        return AI_ERRORS[context].no_api_key;
    if (msg.includes('tokens per day') || msg.includes('tpd') || msg.includes('daily'))
        return AI_ERRORS[context].daily_quota;
    if (status === 429 || msg.includes('rate limit') || msg.includes('too many requests'))
        return AI_ERRORS[context].rate_limit;
    if (status === 529 || msg.includes('overload') || msg.includes('capacity'))
        return AI_ERRORS[context].overloaded;
    if (status === 400 || msg.includes('invalid') || msg.includes('malformed'))
        return AI_ERRORS[context].invalid_input;
    if (msg.includes('network') || msg.includes('econnrefused') || msg.includes('fetch'))
        return AI_ERRORS[context].network;
    return AI_ERRORS[context].default;
}


const MODEL_SMART = 'llama-3.3-70b-versatile';

function parseHistory(history) {
    if (!history) return [];

    if (Array.isArray(history)) {
        const filtered = history.filter(h => h && h.role && h.content && ['user', 'assistant'].includes(h.role));
        const first = filtered.slice(0, 2);   
        const last  = filtered.slice(-6);     
        const combined = [...first, ...last.filter(h => !first.includes(h))];
        return combined.map(h => ({ role: h.role, content: String(h.content).substring(0, 1500) }));
    }

    // Legacy string format
    if (typeof history === 'string') {
        const lines = history.split('\n').filter(Boolean);
        const messages = [];
        for (const line of lines.slice(-20)) {
            if (/^(User:|المستخدم:)\s*/i.test(line)) {
                messages.push({ role: 'user', content: line.replace(/^(User:|المستخدم:)\s*/i, '').trim() });
            } else if (/^(Assistant:|المساعد:)\s*/i.test(line)) {
                messages.push({ role: 'assistant', content: line.replace(/^(Assistant:|المساعد:)\s*/i, '').trim() });
            }
        }
        return messages.slice(-12);
    }

    return [];
}

async function callGroq({
    system,
    messages = [],    
    userMessage = null,  
    model = MODEL_SMART,
    maxTokens = 700,
    temperature = 0.3,
    retries = 1,
    retryDelay = 4000,
}) {
    // Build the full messages array: system → history 
    const fullMessages = [
        { role: 'system', content: system },
        ...messages,
        ...(userMessage ? [{ role: 'user', content: userMessage }] : []),
    ];

    for (let attempt = 0; attempt <= retries; attempt++) {
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
            },
            body: JSON.stringify({
                model,
                max_tokens: maxTokens,
                temperature,
                messages: fullMessages,
            }),
        });

        if (!response.ok) {
            const errBody = await response.json().catch(() => ({}));
            const errMsg = errBody?.error?.message || `HTTP ${response.status}`;
            const err = new Error(errMsg);
            err.status = response.status;

            const isDailyQuota =
                errMsg.toLowerCase().includes('tokens per day') ||
                errMsg.toLowerCase().includes('tpd') ||
                errMsg.toLowerCase().includes('daily');

            if (!isDailyQuota && (response.status === 429 || response.status === 529) && attempt < retries) {
                console.warn(`⚠️ [AI] Temp rate limit. Retrying in ${retryDelay}ms (attempt ${attempt + 1}/${retries})...`);
                await new Promise(resolve => setTimeout(resolve, retryDelay));
                retryDelay *= 2;
                continue;
            }
            if (isDailyQuota)
                console.error('🚫 [AI] Daily token quota exhausted. Resets at midnight UTC.');
            throw err;
        }

        const data = await response.json();
        return data.choices[0].message.content.trim();
    }
}

//size retrieved from the JSON 
function safeJson(data, limit = 2500) {
    try {
        return JSON.stringify(data).substring(0, limit);
    } catch {
        return '{}';
    }
}


class AIService {
   // Generate Strategic Insight 
    async generateStrategicInsight(dashboardData) {
        if (!dashboardData?.warnings?.length) return null;

        const role = dashboardData.userRole || 'موظف';
        const department = dashboardData.userDepartment || 'الشركة';
        const lang = dashboardData.lang || 'ar';     

        const system = prompts.getInsightSystemPrompt(role, department, lang);

        // Build a clean, structured user message with the actual data
        const warningsJson = safeJson(dashboardData.warnings, 2500);
        const dataJson = safeJson(dashboardData.data, 2500);
        const userMessage =
            `WARNINGS:\n${warningsJson}\n\nDASHBOARD DATA:\n${dataJson}`;

        try {
            console.log('🧠 [AI] Generating strategic insight...');
            const text = await callGroq({
                system,
                userMessage,
                maxTokens: 650,
                temperature: 0.2,   
            });
            console.log('✅ [AI] Insight generated.');
            return text;
        } catch (error) {
            console.error('❌ [AI | Insight]', error.status || '', error.message);
            return classifyError(error, 'insight');
        }
    }

    // ── Generate Chat Reply 
    async generateChatReply(message, history, insight, role = 'موظف', department = 'الشركة', replyLang = null) {

        const historyMessages = parseHistory(history);
        const insightBlock = insight 
        ? `\n\n--- DASHBOARD DATA ---\n${insight.substring(0, 10000)}` 
        : `\n\n--- DASHBOARD DATA ---\n[EMPTY - NO DATA SOURCE LOADED BY USER]`;

        const system = prompts.getChatSystemPrompt(role, department) + insightBlock;

        const isArabic = replyLang === 'ar' || (!replyLang && /[\u0600-\u06FF]/.test(message));
        const langHint = isArabic
            ? '[CRITICAL: Reply in pure Arabic ONLY. NEVER output Russian, Cyrillic, or Chinese characters. Keep proper nouns in plain English or translate to Arabic properly.]'
            : '[CRITICAL: Reply in English ONLY. NEVER output Russian or Cyrillic characters.]';

        const userMessage = `${langHint} ${message}`;

        try {
            console.log('🧠 [AI] Generating chat reply...');
            const text = await callGroq({
                system,
                messages:    historyMessages,
                userMessage,
                model:       MODEL_SMART,  
                maxTokens:   700,
                temperature: 0.3,
            });
            console.log('✅ [AI] Chat reply sent.');
            return text;
        } catch (error) {
            console.error('❌ [AI | Chat]', error.status || '', error.message);
            return classifyError(error, 'chat');
        }
    }
}

module.exports = new AIService();