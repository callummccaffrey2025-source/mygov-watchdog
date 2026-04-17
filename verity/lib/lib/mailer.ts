import { ServerClient } from 'postmark';
const client = new ServerClient(process.env.POSTMARK_TOKEN!);
export async function sendMail(to:string, subject:string, html:string, text?:string){
  return client.sendEmail({ From: process.env.EMAIL_FROM!, To: to, Subject: subject, HtmlBody: html, TextBody: text });
}
