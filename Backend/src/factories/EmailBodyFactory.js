// src/factories/EmailBodyFactory.js
// Factory Pattern: constructs the correct email body object based on ticket
// context. Each `build*` method is a named factory method. The controller
// never knows how the email is structured — it only calls a factory method.

class EmailBodyFactory {
    /**
     * Build the email body for an employee-submitted IT support request.
     * (test_mode === true path from itController)
     *
     * @param {string} ticket_type
     * @param {string} targetName
     * @param {string} description  — raw description including [From:] tag
     * @returns {{ emailBody: string, priority: string, cleanDesc: string }}
     */
    buildEmployeeRequest({ ticket_type, targetName, description }) {
        const fromMatch = description.match(/\[From:\s*([^\]]+)\]/i);
        const fromInfo  = fromMatch ? fromMatch[1] : targetName;
        const cleanDesc = description
            .replace(/\[Priority:[^\]]*\]\s*/i, '')
            .replace(/\[From:[^\]]*\]\s*/i, '')
            .trim();

        const emailBody =
            `Hello Admin Team,\n\nA support request has been submitted via the employee portal.\n\n` +
            `──────────────────────────────\n` +
            `Issue Type  : ${ticket_type}\nSubmitted By: ${fromInfo}\n` +
            `──────────────────────────────\n` +
            `Description:\n${cleanDesc}\n` +
            `──────────────────────────────\n\n` +
            `Please follow up with the employee directly.\n\nAnalyticOS Portal`;

        return { emailBody, priority: 'Medium', cleanDesc };
    }

    /**
     * Build the email body for an admin-issued password reset.
     *
     * @param {string} targetName
     * @param {string} description   — raw, may include [Priority:] tag
     * @param {string} tempPassword
     * @returns {{ emailBody: string, priority: string, cleanDesc: string }}
     */
    buildPasswordReset({ targetName, description, tempPassword }) {
        const priorityMatch = description.match(/\[Priority:\s*(\w+)\]/i);
        const priority      = priorityMatch ? priorityMatch[1] : 'Critical';
        const cleanDesc     = description.replace(/\[Priority:[^\]]*\]\s*/i, '').trim();

        const emailBody =
            `Hello ${targetName},\n\nYour password has been reset by the Admin department.\n\n` +
            `Temporary Password: ${tempPassword}\n\n` +
            `Please log in immediately and change your password.\n\n` +
            `──────────────────────────────\nNotes from Admin:\n${cleanDesc}\n` +
            `──────────────────────────────\n\nBest regards,\nAdmin Support Team`;

        return { emailBody, priority, cleanDesc };
    }

    /**
     * Build the email body for a general admin-issued IT ticket.
     *
     * @param {string} ticket_type
     * @param {string} targetName
     * @param {string} description
     * @returns {{ emailBody: string, priority: string, cleanDesc: string }}
     */
    buildGeneralTicket({ ticket_type, targetName, description }) {
        const priorityMatch = description.match(/\[Priority:\s*(\w+)\]/i);
        const priority      = priorityMatch ? priorityMatch[1] : 'Medium';
        const cleanDesc     = description.replace(/\[Priority:[^\]]*\]\s*/i, '').trim();

        const emailBody =
            `Hello ${targetName},\n\nAn Admin support ticket has been logged for your account.\n\n` +
            `Type        : ${ticket_type}\nPriority    : ${priority}\nDescription : ${cleanDesc}\n\n` +
            `Our team will follow up with you shortly.\n\nBest regards,\nAdmin Support Team`;

        return { emailBody, priority, cleanDesc };
    }

    /**
     * Main entry point: dispatches to the correct factory method.
     * Controllers call this method, never the individual builders directly.
     *
     * @param {object} ctx
     * @param {boolean} ctx.isTestMode
     * @param {string}  ctx.ticket_type
     * @param {string}  ctx.targetName
     * @param {string}  ctx.description
     * @param {string}  [ctx.tempPassword]
     * @returns {{ emailBody: string, priority: string, cleanDesc: string }}
     */
    build(ctx) {
        if (ctx.isTestMode) {
            return this.buildEmployeeRequest(ctx);
        }
        if (ctx.ticket_type === 'Password Reset') {
            return this.buildPasswordReset(ctx);
        }
        return this.buildGeneralTicket(ctx);
    }
}

module.exports = new EmailBodyFactory();
