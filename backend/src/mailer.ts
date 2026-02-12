import nodemailer from "nodemailer";
import { env } from "./env.js";

export type SendMagicLinkArgs = { to: string; magicLink: string };

export function hasSmtp(): boolean {
  return Boolean(env.SMTP_HOST && env.SMTP_PORT && env.SMTP_USER && env.SMTP_PASS);
}

export async function sendMagicLinkEmail({ to, magicLink }: SendMagicLinkArgs): Promise<void> {
  if (!hasSmtp()) return;

  const transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: Number(env.SMTP_PORT),
    secure: Number(env.SMTP_PORT) === 465,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
  });

  await transporter.sendMail({
    from: env.SMTP_FROM,
    to,
    subject: "Your magic login link",
    text: `Click to login: ${magicLink}`,
    html: `<p>Click to login:</p><p><a href="${magicLink}">${magicLink}</a></p>`,
  });
}
