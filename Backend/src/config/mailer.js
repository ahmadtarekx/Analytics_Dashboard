const nodemailer = require('nodemailer');

const IT_EMAIL = process.env.IT_EMAIL || 'it.entreprisex@gmail.com';

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: IT_EMAIL,
        pass: process.env.IT_EMAIL_PASS || 'eeme uhuh qdpg mslp',
    },
});

module.exports = { transporter, IT_EMAIL };
