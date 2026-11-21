import type { Transporter } from "nodemailer";
import { db } from "./db";

/**
 * 邮件投递：配置了 SMTP_* 环境变量时真实发送；未配置时落库并标记 SIMULATED。
 * 无论哪种情况，提醒邮件都会先写入 EmailOutbox，保证可审计、可重试。
 *
 * nodemailer 通过 webpackIgnore 动态加载：避免 Next 的 edge instrumentation
 * 打包 Node 内置模块；真实发送时再由 Node 运行时从 node_modules 解析。
 */
type NodemailerModule = typeof import("nodemailer");

let nodemailerPromise: Promise<NodemailerModule | null> | null = null;
let cachedTransporter: Transporter | null = null;

export function mailerConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

async function loadNodemailer(): Promise<NodemailerModule | null> {
  if (!mailerConfigured()) return null;
  if (!nodemailerPromise) {
    nodemailerPromise = import(/* webpackIgnore: true */ "nodemailer")
      .then((mod) => ((mod as { default?: NodemailerModule }).default ?? mod) as NodemailerModule)
      .catch((error) => {
        console.error("[campus-mailer] nodemailer 加载失败", error);
        return null;
      });
  }
  return nodemailerPromise;
}

async function getTransporter(): Promise<Transporter | null> {
  if (cachedTransporter) return cachedTransporter;

  const nodemailer = await loadNodemailer();
  if (!nodemailer) return null;

  const port = Number(process.env.SMTP_PORT ?? 465);
  cachedTransporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
  return cachedTransporter;
}

export type OutboxResult = { sent: number; simulated: number; failed: number };

/** 批量投递待发邮件；单封失败不影响其他邮件 */
export async function flushEmailOutbox(limit = 20): Promise<OutboxResult> {
  const rows = await db.emailOutbox.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "asc" },
    take: limit,
  });
  if (rows.length === 0) return { sent: 0, simulated: 0, failed: 0 };

  const transporter = await getTransporter();
  if (!transporter) {
    await db.emailOutbox.updateMany({
      where: { id: { in: rows.map((row) => row.id) } },
      data: { status: "SIMULATED", sentAt: new Date(), error: "SMTP 未配置，已记录为模拟发送" },
    });
    return { sent: 0, simulated: rows.length, failed: 0 };
  }

  const from = process.env.SMTP_FROM ?? process.env.SMTP_USER ?? "no-reply@campus-hub.local";
  let sent = 0;
  let failed = 0;

  for (const row of rows) {
    try {
      await transporter.sendMail({
        from,
        to: row.toEmail,
        subject: row.subject,
        text: row.content,
      });
      await db.emailOutbox.update({
        where: { id: row.id },
        data: { status: "SENT", sentAt: new Date(), error: null },
      });
      sent += 1;
    } catch (error) {
      failed += 1;
      await db.emailOutbox.update({
        where: { id: row.id },
        data: {
          status: "FAILED",
          error: error instanceof Error ? error.message.slice(0, 500) : "邮件发送失败",
        },
      });
    }
  }

  return { sent, simulated: 0, failed };
}
