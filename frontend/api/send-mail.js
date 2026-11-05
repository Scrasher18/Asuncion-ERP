const nodemailer = require('nodemailer');

module.exports = async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { to, subject, html, fromName, username, pass } = req.body || {};

    if (!to || !subject || !html) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: to, subject, html'
      });
    }

    const userEmail = (username || process.env.MAIL_USER || '').trim();
    const appPassword = (pass || process.env.MAIL_APP_PASSWORD || '').replace(/\s+/g, '');
    const senderName = fromName || 'Repuestos Asunción';

    if (!userEmail || !appPassword) {
      return res.status(400).json({
        success: false,
        error: 'Credenciales de correo no configuradas'
      });
    }

    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: {
        user: userEmail,
        pass: appPassword
      },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000
    });

    const info = await transporter.sendMail({
      from: `"${senderName}" <${userEmail}>`,
      to: to.trim(),
      subject: subject.trim(),
      html: html
    });

    return res.status(200).json({
      success: true,
      messageId: info.messageId,
      envelope: info.envelope
    });
  } catch (error) {
    console.error('Email sending error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to send email'
    });
  }
};
