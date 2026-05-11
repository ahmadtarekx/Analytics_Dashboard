// src/services/AuthService.js
// Service Layer: all business logic for authentication.
// It depends on AuthRepository (data) and mailer (side-effects).
// Controllers call this service — they never touch bcrypt or DB directly.

const bcrypt      = require('bcrypt');
const AuthRepository = require('../repositories/AuthRepository');
const { transporter, IT_EMAIL } = require('../config/mailer');

class AuthService {
    /**
     * Validate credentials and return a public user object.
     * Throws an Error with { status, message } on failure.
     *
     * @param {string} email
     * @param {string} password
     * @returns {object} Safe user payload for the frontend.
     */
    async login(email, password) {
        const userRecord = await AuthRepository.findUserByEmail(email);
        if (!userRecord) {
            const err = new Error('الإيميل غير مسجل!');
            err.status = 401;
            throw err;
        }

        const isMatch = await bcrypt.compare(password, userRecord.pass);
        if (!isMatch) {
            const err = new Error('الباسورد غلط!');
            err.status = 401;
            throw err;
        }

        return {
            id:                   userRecord.emp_id,
            name:                 `${userRecord.fname} ${userRecord.lname}`,
            email,
            role:                 userRecord.role,
            salary:               userRecord.salary,
            phone:                userRecord.phone,
            address:              userRecord.address,
            gender:               userRecord.gender,
            birth:                userRecord.birth,
            hired:                userRecord.hired,
            department_id:        userRecord.departement_id,
            department_name:      userRecord.department_name,
            branch_id:            userRecord.branch_id,
            primary_branch:       userRecord.primary_branch_location,
            secondary_branch_id:  userRecord.secondary_branch_id,
            secondary_branch:     userRecord.secondary_branch_location,
        };
    }

    /**
     * Generate a temporary password, persist it, and email it to the user.
     * Throws an Error on failure.
     *
     * @param {string} email
     */
    async forgotPassword(email) {
        const user = await AuthRepository.findAccountByEmail(email);
        if (!user) {
            const err = new Error('No account found with this email.');
            err.status = 404;
            throw err;
        }

        const tempPassword = Math.random().toString(36).slice(-8) + 'X9*';
        const hashed       = await bcrypt.hash(tempPassword, 10);

        await AuthRepository.resetPasswordAndLogTicket(email, hashed, user.emp_id);

        await transporter.sendMail({
            from:    IT_EMAIL,
            to:      user.mail,
            subject: 'AnalyticOS: Your Password Has Been Reset',
            text:    `Hello ${user.first_name},\n\nYou requested a password reset.\n\nNew Password: ${tempPassword}\n\nPlease log in and keep this safe.\n\nAutomated Admin Support System`,
        });
    }
}

module.exports = new AuthService();
