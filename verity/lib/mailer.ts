import { ServerClient } from 'postmark';

const token = process.env.POSTMARK_TOKEN!;
const from = process.env.EMAIL_FROM!;
const client = new ServerClient(token);

export async function sendMail(to: string, subject: string, html: string, text?: string) {
  if (!token || !from) throw new Error('Postmark env missing');
  return client.sendEmail({ From: from, To: to, Subject: subject, HtmlBody: html, TextBody: text });
}
