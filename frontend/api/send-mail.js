const nodemailerPkg = require('nodemailer');
const mailer = nodemailerPkg.createTransport ? nodemailerPkg : nodemailerPkg.default;

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const { to, subject, html, fromName, username, pass } = body;

    if (!to || !subject || !html) {
      return res.status(400).json({
        success: false,
        error: 'Faltan campos obligatorios (to, subject, html)',
      });
    }

    const userEmail = (
      username ||
      process.env.MAIL_USER ||
      process.env.MAIL_USERNAME ||
      'scrasher322@gmail.com'
    ).trim();

    const appPassword = (
      pass ||
      process.env.MAIL_APP_PASSWORD ||
      process.env.MAIL_PASSWORD ||
      ''
    ).replace(/\s+/g, '');

    const senderName = (fromName || 'Repuestos Asunción').trim();

    if (!userEmail || !appPassword) {
      return res.status(400).json({
        success: false,
        error:
          'Falta configurar la Contraseña de Aplicación de Google (16 letras) en Administración -> Correo y notificaciones.',
      });
    }

    const mailOptions = {
      from: `"${senderName.replace(/"/g, '')}" <${userEmail}>`,
      to: to.trim(),
      subject: subject.trim(),
      html,
    };

    try {
      const transporter465 = mailer.createTransport({
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        auth: { user: userEmail, pass: appPassword },
        connectionTimeout: 9000,
        greetingTimeout: 9000,
        socketTimeout: 14000,
      });
      const info = await transporter465.sendMail(mailOptions);
      return res.status(200).json({
        success: true,
        messageId: info.messageId,
        envelope: info.envelope,
      });
    } catch (err465) {
      const msg465 = String((err465 && err465.message) || '');
      if (msg465.includes('535') || msg465.toLowerCase().includes('username and password not accepted')) {
        return res.status(401).json({
          success: false,
          error:
            'Google rechazó la clave (535). Ingresa una Contraseña de Aplicación de Google de 16 letras (no tu clave normal de Gmail).',
        });
      }

      const transporter587 = mailer.createTransport({
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        requireTLS: true,
        auth: { user: userEmail, pass: appPassword },
        connectionTimeout: 9000,
        greetingTimeout: 9000,
        socketTimeout: 14000,
      });
      const info587 = await transporter587.sendMail(mailOptions);
      return res.status(200).json({
        success: true,
        messageId: info587.messageId,
        envelope: info587.envelope,
      });
    }
  } catch (error) {
    const rawMsg = String((error && error.message) || 'Error desconocido al enviar correo');
    const friendly =
      rawMsg.includes('535') || rawMsg.toLowerCase().includes('username and password not accepted')
        ? 'Google rechazó la clave (535). Ingresa una Contraseña de Aplicación de Google de 16 letras (no tu clave normal de Gmail).'
        : rawMsg;
    console.error('Email relay error:', rawMsg);
    return res.status(500).json({
      success: false,
      error: friendly,
    });
  }
};
