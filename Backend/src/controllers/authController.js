// src/controllers/authController.js
// SRP: only handles HTTP request/response. All logic is in AuthService.

const AuthService = require('../services/AuthService');

async function login(req, res, next) {
    try {
        const user = await AuthService.login(req.body.email, req.body.password);
        return res.status(200).json({ message: 'تسجيل دخول ناجح!', user });
    } catch (err) { next(err); }
}

async function forgotPassword(req, res, next) {
    try {
        if (!req.body.email) return res.status(400).json({ error: 'Email is required.' });
        await AuthService.forgotPassword(req.body.email);
        return res.json({ message: 'A new password has been sent to your email.' });
    } catch (err) { next(err); }
}

module.exports = { login, forgotPassword };
