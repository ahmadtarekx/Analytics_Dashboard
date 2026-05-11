// src/services/PRService.js
// Service Layer: business logic for PR campaigns and press releases.

const EmployeeRepository = require('../repositories/EmployeeRepository');
const TicketRepository   = require('../repositories/TicketRepository');

const OWNER_ID = 91949;

class PRService {
    async submitCampaign({ emp_id, emp_name, campaign_name, campaign_type, platform, budget, target_audience, campaign_start_date, campaign_end_date, notes }) {
        let managerId = await EmployeeRepository.findManagerIdByDept(4);
        if (!managerId) { console.warn('No PR Manager found. Falling back to Owner.'); managerId = OWNER_ID; }

        const payload = JSON.stringify({
            action: 'CAMPAIGN_REQUEST', emp_id: parseInt(emp_id), emp_name: emp_name || 'Unknown',
            campaign_name, campaign_type, platform: platform || 'Multi-channel',
            budget: budget ? parseFloat(budget) : 0,
            target_audience: target_audience?.trim() || 'General',
            campaign_start_date: campaign_start_date || null,
            campaign_end_date: campaign_end_date || null,
            notes: notes?.trim() || '', submitted_at: new Date().toISOString(), status: 'pending',
        });
        await TicketRepository.create(managerId, 'Inquiry', `[CAMPAIGN_REQUEST] ${payload}`);
        return { message: `Campaign "${campaign_name}" submitted for manager review.` };
    }

    async getMyCampaigns(empId) {
        const managerId = await EmployeeRepository.findManagerIdByDept(4);
        if (!managerId) return [];
        const rows = await TicketRepository.findByEmployeeAndPrefix(managerId, '[CAMPAIGN_REQUEST]%');
        return rows
            .filter(r => { try { return JSON.parse(r.description.replace('[CAMPAIGN_REQUEST] ', '')).emp_id === parseInt(empId); } catch { return false; } })
            .map(r => { let d = {}; try { d = JSON.parse(r.description.replace('[CAMPAIGN_REQUEST] ', '')); } catch {} return { ticket_id: r.ticket_id, time: r.time, ...d }; });
    }

    async getPendingCampaigns(managerId) {
        const rows = await TicketRepository.findByEmployeeAndPrefix(managerId, '[CAMPAIGN_REQUEST]%');
        const prRows = await TicketRepository.findByEmployeeAndPrefix(managerId, '[PRESS_RELEASE]%');
        return [...rows, ...prRows].map(r => {
            let d = {};
            try {
                const isPR   = r.description.startsWith('[PRESS_RELEASE]');
                const prefix = isPR ? '[PRESS_RELEASE] ' : '[CAMPAIGN_REQUEST] ';
                d = JSON.parse(r.description.replace(prefix, ''));
                if (isPR) d._type = 'press_release';
            } catch {}
            return { ticket_id: r.ticket_id, time: r.time, ...d };
        });
    }

    async resolveCampaign(ticket_id) {
        await TicketRepository.delete(parseInt(ticket_id));
        return { message: 'Campaign resolved.' };
    }

    async submitPressRelease({ emp_id, emp_name, title, content, target_date, media_outlets }) {
        const payload = JSON.stringify({
            action: 'PRESS_RELEASE', emp_id: parseInt(emp_id), emp_name: emp_name || 'Unknown',
            title, content: content.trim(),
            target_date: target_date || null, media_outlets: media_outlets?.trim() || null,
            submitted_at: new Date().toISOString(),
        });
        await TicketRepository.create(OWNER_ID, 'Inquiry', `[PRESS_RELEASE] ${payload}`);
        return { message: `Press release "${title}" submitted for manager approval.` };
    }

    async getPressReleases(managerId) {
        const rows = await TicketRepository.findByEmployeeAndPrefix(parseInt(managerId), '[PRESS_RELEASE]%');
        return rows.map(r => { let d = {}; try { d = JSON.parse(r.description.replace('[PRESS_RELEASE] ', '')); } catch {} return { ticket_id: r.ticket_id, time: r.time, ...d }; });
    }
}

module.exports = new PRService();
