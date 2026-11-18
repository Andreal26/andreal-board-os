/**
 * Email via any SMTP server. Free option: Gmail + App Password (smtp.gmail.com:465).
 * When SMTP isn't configured, emails are logged to the console instead of sent.
 */
export function mailConfigured() {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

export async function sendMail(to: string[], subject: string, html: string): Promise<{ sent: boolean; info: string }> {
  const recipients = Array.from(new Set(to.map((t) => t.trim()).filter(Boolean)));
  if (!recipients.length) return { sent: false, info: 'no recipients' };
  if (!mailConfigured()) {
    console.log(`[mail:dry-run] to=${recipients.join(',')} subject="${subject}"`);
    return { sent: false, info: 'SMTP not configured (dry run)' };
  }
  const nodemailer = (await import('nodemailer')).default;
  const port = Number(process.env.SMTP_PORT || 465);
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  await transport.sendMail({ from: process.env.MAIL_FROM || process.env.SMTP_USER, to: recipients.join(','), subject, html });
  return { sent: true, info: `sent to ${recipients.length}` };
}

export const boardEmails = () => (process.env.BOARD_EMAILS || '').split(',').map((s) => s.trim()).filter(Boolean);
export const appUrl = () => (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '');

export function emailShell(title: string, body: string) {
  return `<!doctype html><html><body style="margin:0;background:#0b0d10;font-family:Poppins,Segoe UI,Arial,sans-serif;color:#e8eaed">
  <div style="max-width:680px;margin:0 auto;padding:24px">
    <div style="font-size:12px;letter-spacing:2px;color:#3fd6c8;text-transform:uppercase">Andreal · Anderson Board OS</div>
    <h1 style="font-size:20px;margin:6px 0 18px;color:#fff">${title}</h1>
    ${body}
    <p style="font-size:12px;color:#8a929c;margin-top:24px">Open the dashboard: <a style="color:#3fd6c8" href="${appUrl()}">${appUrl()}</a></p>
  </div></body></html>`;
}
