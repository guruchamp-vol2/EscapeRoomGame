// Sends password-reset emails. With SMTP configured (SMTP_HOST etc.) it uses
// nodemailer; otherwise it prints the email to the server console, which is
// enough for local development and testing.
export function createMailer(env = process.env) {
  if (!env.SMTP_HOST) {
    return {
      configured: false,
      async send({ to, subject, text }) {
        console.log(`\n[mail] (SMTP not configured — printing instead)\nTo: ${to}\nSubject: ${subject}\n\n${text}\n`);
      },
    };
  }

  let transport = null;
  return {
    configured: true,
    async send({ to, subject, text }) {
      if (!transport) {
        const { default: nodemailer } = await import('nodemailer');
        transport = nodemailer.createTransport({
          host: env.SMTP_HOST,
          port: Number(env.SMTP_PORT) || 587,
          secure: env.SMTP_SECURE === '1',
          auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
        });
      }
      await transport.sendMail({ from: env.MAIL_FROM || env.SMTP_USER, to, subject, text });
    },
  };
}
