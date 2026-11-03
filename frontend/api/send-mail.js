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
    const { to, subject, html, fromName, pass } = req.body || {};

    if (!to || !subject || !html) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: to, subject, html'
      });
    }

    const appPassword = (pass || process.env.MAIL_APP_PASSWORD || 'yivelgtbkmgjpcxx').replace(/\s+/g, '');
    const userEmail = process.env.MAIL_USER || 'scrasher322@gmail.com';
    const senderName = fromName || 'Repuestos Asunción';

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
      message: `Correo enviado exitosamente a ${to}`
    });
  } catch (error) {
    console.error('Mail delivery relay error:', error);
    const errText = error?.message || String(error);
    const isAuthError = errText.includes('535') || errText.toLowerCase().includes('badcredentials');

    return res.status(200).json({
      success: false,
      isAuthError,
      error: isAuthError
        ? 'Google rechazó la contraseña de aplicación (535 BadCredentials). Se requiere generar una nueva clave de 16 letras en myaccount.google.com/apppasswords'
        : `Error de entrega: ${errText}`
    });
  }
};
