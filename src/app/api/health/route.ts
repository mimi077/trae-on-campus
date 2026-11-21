import { NextResponse } from "next/server";
import { ensureDatabase } from "@/server/bootstrap";
import { db } from "@/server/db";

export const dynamic = "force-dynamic";

/** 运行期健康检查：验证数据库落盘、建表与种子数据是否正常 */
export async function GET() {
  try {
    await ensureDatabase();
    const [items, wishes, users] = await Promise.all([
      db.item.count(),
      db.wishPurchase.count(),
      db.user.count(),
    ]);
    return NextResponse.json({
      ok: true,
      databaseUrl: process.env.DATABASE_URL,
      counts: { items, wishes, users },
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        databaseUrl: process.env.DATABASE_URL,
        error: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 },
    );
  }
}
