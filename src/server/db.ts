import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

/**
 * 运行环境差异处理：
 * - 本地开发：`.env` 提供 `file:./dev.db`，由 Prisma 解析到 prisma/dev.db；
 * - 线上容器：应用目录只读，缺失 DATABASE_URL 时自动落到 TMPDIR 下的可写 SQLite 文件，
 *   并在首次请求时由 bootstrap 幂等建表 + 灌入演示数据。
 */
function ensureDatabaseUrl() {
  const configured = process.env.DATABASE_URL?.trim();
  if (configured) {
    if (configured.startsWith("file:")) {
      const filePath = configured.slice("file:".length);
      if (path.isAbsolute(filePath)) {
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
      }
    }
    return;
  }

  const dir = path.join(process.env.TMPDIR || os.tmpdir(), "campus-market");
  fs.mkdirSync(dir, { recursive: true });
  process.env.DATABASE_URL = `file:${path.join(dir, "dev.db")}`;
}

ensureDatabaseUrl();

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
