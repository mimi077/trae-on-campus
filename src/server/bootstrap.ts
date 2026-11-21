import { db } from "./db";
import { seedDatabase } from "./seed-database";

/**
 * 运行期数据库初始化。
 * 本地开发可用 `prisma db push` 建表；生产的应用目录不可写时，SQLite 落在 TMPDIR，
 * 进程启动后的首个接口调用会幂等建表并灌入演示数据。
 * 注意：临时目录不等于持久存储，正式环境需要接入外部数据库（Postgres / Turso 等）。
 */
const DDL = [
  `CREATE TABLE IF NOT EXISTS "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "campus" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'USER',
    "studentNo" TEXT,
    "passwordHash" TEXT,
    "email" TEXT,
    "college" TEXT,
    "major" TEXT,
    "grade" TEXT,
    "bio" TEXT,
    "avatarColor" TEXT,
    "className" TEXT,
    "authStatus" TEXT NOT NULL DEFAULT 'UNAUTH',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS "Item" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "sceneTags" TEXT NOT NULL DEFAULT '[]',
    "dealTags" TEXT NOT NULL DEFAULT '[]',
    "isGift" BOOLEAN NOT NULL DEFAULT false,
    "bargainMode" TEXT NOT NULL DEFAULT 'FREE_BARGAIN',
    "isbn" TEXT,
    "price" REAL NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ON_SALE',
    "expiresAt" DATETIME,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS "Favorite" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Favorite_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS "IntentFavorite" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "IntentFavorite_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS "WishPurchase" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "expectPrice" REAL NOT NULL,
    "description" TEXT,
    "expireAt" DATETIME NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS "Bid" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "itemId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "price" REAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS "GiftApproval" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "giftItemId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS "Message" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fromUserId" TEXT NOT NULL,
    "toUserId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "relatedItemId" TEXT,
    "relatedWishId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS "Report" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reporterUserId" TEXT NOT NULL,
    "targetItemId" TEXT,
    "targetWishId" TEXT,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS "AdminLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "adminUserId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS "LostFound" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "kind" TEXT NOT NULL DEFAULT 'LOST',
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "happenedAt" DATETIME NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT,
    "contact" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reviewNote" TEXT,
    "reviewedBy" TEXT,
    "reviewedAt" DATETIME,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS "LostFoundMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "recordId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LostFoundMessage_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "LostFound" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS "Activity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "organizer" TEXT NOT NULL,
    "startAt" DATETIME NOT NULL,
    "endAt" DATETIME NOT NULL,
    "registrationDeadline" DATETIME NOT NULL,
    "location" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL,
    "isUnlimited" BOOLEAN NOT NULL DEFAULT false,
    "submissionDeadline" DATETIME,
    "showcaseEnabled" BOOLEAN NOT NULL DEFAULT false,
    "registrationMode" TEXT NOT NULL DEFAULT 'INTERNAL',
    "externalUrl" TEXT,
    "summary" TEXT,
    "description" TEXT,
    "coverUrl" TEXT,
    "tags" TEXT NOT NULL DEFAULT '[]',
    "creditPoints" REAL,
    "publisherContact" TEXT,
    "qqGroup" TEXT,
    "targetCollege" TEXT NOT NULL DEFAULT '[]',
    "targetGrade" TEXT NOT NULL DEFAULT '[]',
    "targetMajor" TEXT NOT NULL DEFAULT '[]',
    "targetClass" TEXT NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reviewNote" TEXT,
    "reviewedBy" TEXT,
    "reviewedAt" DATETIME,
    "createdBy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS "Registration" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "activityId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'APPROVED',
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Registration_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS "ActivityMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "activityId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ActivityMessage_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS "WorkCategory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "activityId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS "ShowcaseWork" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "activityId" TEXT NOT NULL,
    "categoryId" TEXT,
    "createdBy" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "workUrl" TEXT,
    "coverUrl" TEXT,
    "media" TEXT NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reviewNote" TEXT,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ShowcaseWork_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ShowcaseWork_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "WorkCategory" ("id") ON DELETE SET NULL ON UPDATE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS "UserNotification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'SYSTEM',
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "link" TEXT,
    "readAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS "EmailOutbox" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "toEmail" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "error" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" DATETIME
  )`,
  `CREATE TABLE IF NOT EXISTS "DeadlineReminder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "activityId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "User_studentNo_key" ON "User"("studentNo")`,
  `CREATE TABLE IF NOT EXISTS "HotActivity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isExternal" BOOLEAN NOT NULL DEFAULT false,
    "externalUrl" TEXT,
    "activityId" TEXT,
    "title" TEXT NOT NULL,
    "coverUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS "AdminNotice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "dept" TEXT NOT NULL,
    "targetCollege" TEXT,
    "targetGrade" TEXT,
    "targetMajor" TEXT,
    "targetClass" TEXT,
    "createdBy" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "publishAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS "UserNoticeRead" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "noticeId" TEXT NOT NULL,
    "readAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS "TimetableCourse" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "teacher" TEXT,
    "location" TEXT,
    "weekday" INTEGER NOT NULL,
    "startSection" INTEGER NOT NULL,
    "endSection" INTEGER NOT NULL,
    "startWeek" INTEGER NOT NULL,
    "endWeek" INTEGER NOT NULL,
    "weekType" TEXT NOT NULL DEFAULT 'ALL',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS "HotActivity_sortOrder_idx" ON "HotActivity"("sortOrder")`,
  `CREATE INDEX IF NOT EXISTS "AdminNotice_isActive_createdAt_idx" ON "AdminNotice"("isActive", "createdAt")`,
  `CREATE INDEX IF NOT EXISTS "AdminNotice_isActive_publishAt_idx" ON "AdminNotice"("isActive", "publishAt")`,
  `CREATE INDEX IF NOT EXISTS "TimetableCourse_userId_idx" ON "TimetableCourse"("userId")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "UserNoticeRead_userId_noticeId_key" ON "UserNoticeRead"("userId", "noticeId")`,
  `CREATE INDEX IF NOT EXISTS "UserNoticeRead_userId_idx" ON "UserNoticeRead"("userId")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "Session_token_key" ON "Session"("token")`,
  `CREATE INDEX IF NOT EXISTS "Session_userId_idx" ON "Session"("userId")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "Favorite_userId_itemId_key" ON "Favorite"("userId", "itemId")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "IntentFavorite_userId_itemId_key" ON "IntentFavorite"("userId", "itemId")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "Bid_userId_itemId_key" ON "Bid"("userId", "itemId")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "GiftApproval_userId_giftItemId_key" ON "GiftApproval"("userId", "giftItemId")`,
  `CREATE INDEX IF NOT EXISTS "Message_fromUserId_idx" ON "Message"("fromUserId")`,
  `CREATE INDEX IF NOT EXISTS "Message_toUserId_idx" ON "Message"("toUserId")`,
  `CREATE INDEX IF NOT EXISTS "Report_status_idx" ON "Report"("status")`,
  `CREATE INDEX IF NOT EXISTS "WishPurchase_expireAt_idx" ON "WishPurchase"("expireAt")`,
  `CREATE INDEX IF NOT EXISTS "LostFound_status_idx" ON "LostFound"("status")`,
  `CREATE INDEX IF NOT EXISTS "LostFound_kind_idx" ON "LostFound"("kind")`,
  `CREATE INDEX IF NOT EXISTS "LostFoundMessage_recordId_idx" ON "LostFoundMessage"("recordId")`,
  `CREATE INDEX IF NOT EXISTS "Activity_status_startAt_idx" ON "Activity"("status", "startAt")`,
  `CREATE INDEX IF NOT EXISTS "Activity_source_idx" ON "Activity"("source")`,
  `CREATE INDEX IF NOT EXISTS "Activity_createdBy_idx" ON "Activity"("createdBy")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "Registration_userId_activityId_key" ON "Registration"("userId", "activityId")`,
  `CREATE INDEX IF NOT EXISTS "Registration_activityId_status_idx" ON "Registration"("activityId", "status")`,
  `CREATE INDEX IF NOT EXISTS "Registration_userId_idx" ON "Registration"("userId")`,
  `CREATE INDEX IF NOT EXISTS "ActivityMessage_activityId_idx" ON "ActivityMessage"("activityId")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "WorkCategory_activityId_name_key" ON "WorkCategory"("activityId", "name")`,
  `CREATE INDEX IF NOT EXISTS "WorkCategory_activityId_sortOrder_idx" ON "WorkCategory"("activityId", "sortOrder")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "ShowcaseWork_activityId_createdBy_key" ON "ShowcaseWork"("activityId", "createdBy")`,
  `CREATE INDEX IF NOT EXISTS "ShowcaseWork_activityId_status_pinned_sortOrder_idx" ON "ShowcaseWork"("activityId", "status", "pinned", "sortOrder")`,
  `CREATE INDEX IF NOT EXISTS "ShowcaseWork_categoryId_idx" ON "ShowcaseWork"("categoryId")`,
  `CREATE INDEX IF NOT EXISTS "UserNotification_userId_createdAt_idx" ON "UserNotification"("userId", "createdAt")`,
  `CREATE INDEX IF NOT EXISTS "UserNotification_userId_readAt_idx" ON "UserNotification"("userId", "readAt")`,
  `CREATE INDEX IF NOT EXISTS "EmailOutbox_status_createdAt_idx" ON "EmailOutbox"("status", "createdAt")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "DeadlineReminder_activityId_userId_stage_key" ON "DeadlineReminder"("activityId", "userId", "stage")`,
  `CREATE INDEX IF NOT EXISTS "DeadlineReminder_activityId_idx" ON "DeadlineReminder"("activityId")`,
];

/** 兼容 V1/V2 遗留数据库：补齐新增字段，避免旧库直接报 no such column */
const ITEM_COLUMNS: { name: string; ddl: string }[] = [
  { name: "sceneTags", ddl: `ALTER TABLE "Item" ADD COLUMN "sceneTags" TEXT NOT NULL DEFAULT '[]'` },
  { name: "dealTags", ddl: `ALTER TABLE "Item" ADD COLUMN "dealTags" TEXT NOT NULL DEFAULT '[]'` },
  { name: "isGift", ddl: `ALTER TABLE "Item" ADD COLUMN "isGift" BOOLEAN NOT NULL DEFAULT false` },
  {
    name: "bargainMode",
    ddl: `ALTER TABLE "Item" ADD COLUMN "bargainMode" TEXT NOT NULL DEFAULT 'FREE_BARGAIN'`,
  },
  { name: "isbn", ddl: `ALTER TABLE "Item" ADD COLUMN "isbn" TEXT` },
  { name: "expiresAt", ddl: `ALTER TABLE "Item" ADD COLUMN "expiresAt" DATETIME` },
];

const USER_COLUMNS: { name: string; ddl: string }[] = [
  { name: "studentNo", ddl: `ALTER TABLE "User" ADD COLUMN "studentNo" TEXT` },
  { name: "passwordHash", ddl: `ALTER TABLE "User" ADD COLUMN "passwordHash" TEXT` },
  { name: "email", ddl: `ALTER TABLE "User" ADD COLUMN "email" TEXT` },
  { name: "college", ddl: `ALTER TABLE "User" ADD COLUMN "college" TEXT` },
  { name: "major", ddl: `ALTER TABLE "User" ADD COLUMN "major" TEXT` },
  { name: "grade", ddl: `ALTER TABLE "User" ADD COLUMN "grade" TEXT` },
  { name: "bio", ddl: `ALTER TABLE "User" ADD COLUMN "bio" TEXT` },
  { name: "avatarColor", ddl: `ALTER TABLE "User" ADD COLUMN "avatarColor" TEXT` },
  { name: "className", ddl: `ALTER TABLE "User" ADD COLUMN "className" TEXT` },
  {
    name: "authStatus",
    ddl: `ALTER TABLE "User" ADD COLUMN "authStatus" TEXT NOT NULL DEFAULT 'UNAUTH'`,
  },
  {
    name: "updatedAt",
    ddl: `ALTER TABLE "User" ADD COLUMN "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP`,
  },
];

/** V7.1 活动扩展字段：旧库补列，默认值保证原有活动继续可用 */
const ACTIVITY_COLUMNS: { name: string; ddl: string }[] = [
  { name: "creditPoints", ddl: `ALTER TABLE "Activity" ADD COLUMN "creditPoints" REAL` },
  { name: "publisherContact", ddl: `ALTER TABLE "Activity" ADD COLUMN "publisherContact" TEXT` },
  { name: "qqGroup", ddl: `ALTER TABLE "Activity" ADD COLUMN "qqGroup" TEXT` },
  {
    name: "targetCollege",
    ddl: `ALTER TABLE "Activity" ADD COLUMN "targetCollege" TEXT NOT NULL DEFAULT '[]'`,
  },
  {
    name: "targetGrade",
    ddl: `ALTER TABLE "Activity" ADD COLUMN "targetGrade" TEXT NOT NULL DEFAULT '[]'`,
  },
  {
    name: "targetMajor",
    ddl: `ALTER TABLE "Activity" ADD COLUMN "targetMajor" TEXT NOT NULL DEFAULT '[]'`,
  },
  {
    name: "targetClass",
    ddl: `ALTER TABLE "Activity" ADD COLUMN "targetClass" TEXT NOT NULL DEFAULT '[]'`,
  },
  // V8：无限名额 / 作品提交截止 / 作品专区开关
  {
    name: "isUnlimited",
    ddl: `ALTER TABLE "Activity" ADD COLUMN "isUnlimited" BOOLEAN NOT NULL DEFAULT false`,
  },
  {
    name: "submissionDeadline",
    ddl: `ALTER TABLE "Activity" ADD COLUMN "submissionDeadline" DATETIME`,
  },
  {
    name: "showcaseEnabled",
    ddl: `ALTER TABLE "Activity" ADD COLUMN "showcaseEnabled" BOOLEAN NOT NULL DEFAULT false`,
  },
];

/** V9 通知发布时间：旧库补列后把历史通知的发布时间回填为原始创建时间 */
const NOTICE_COLUMNS: { name: string; ddl: string }[] = [
  { name: "publishAt", ddl: `ALTER TABLE "AdminNotice" ADD COLUMN "publishAt" DATETIME` },
];

async function ensureColumns(table: string, columns: { name: string; ddl: string }[]) {
  const existing = await db.$queryRawUnsafe<{ name: string }[]>(`PRAGMA table_info("${table}")`);
  const names = new Set(existing.map((column) => column.name));
  for (const column of columns) {
    if (!names.has(column.name)) {
      await db.$executeRawUnsafe(column.ddl);
    }
  }
}

async function enableConcurrencyPragmas() {
  try {
    // WAL + busy_timeout 提升单实例并发读写表现，避免高并发下 database is locked
    await db.$queryRawUnsafe(`PRAGMA journal_mode=WAL`);
    await db.$queryRawUnsafe(`PRAGMA busy_timeout=5000`);
    await db.$queryRawUnsafe(`PRAGMA synchronous=NORMAL`);
  } catch {
    // 某些文件系统不支持 WAL，降级后仍可正常读写
  }
}

async function initDatabase() {
  for (const statement of DDL) {
    await db.$executeRawUnsafe(statement);
  }
  await ensureColumns("Item", ITEM_COLUMNS);
  await ensureColumns("User", USER_COLUMNS);
  await ensureColumns("Activity", ACTIVITY_COLUMNS);
  await ensureColumns("AdminNotice", NOTICE_COLUMNS);
  // 旧数据补上到期时间：按发布时间 +14 天
  await db.$executeRawUnsafe(
    `UPDATE "Item" SET "expiresAt" = datetime("createdAt", '+14 days') WHERE "expiresAt" IS NULL`,
  );
  // 旧通知没有发布时间：按创建时间回填，保证历史通知立即可见
  await db.$executeRawUnsafe(
    `UPDATE "AdminNotice" SET "publishAt" = "createdAt" WHERE "publishAt" IS NULL`,
  );
  await enableConcurrencyPragmas();
  // 顺带清理过期会话，避免 Session 表无限增长
  await db.session.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  await seedDatabase(db);
}

let bootstrapPromise: Promise<void> | null = null;

export function ensureDatabase(): Promise<void> {
  if (!bootstrapPromise) {
    bootstrapPromise = initDatabase()
      .then(() => {
        // 数据库就绪后再启动截止提醒调度器，避免冷启动时表尚未创建
        if (process.env.DISABLE_REMINDER_SCHEDULER !== "1") {
          void import("./scheduler")
            .then(({ startReminderScheduler }) => startReminderScheduler())
            .catch((error) => console.error("[campus-reminder] 调度器启动失败", error));
        }
      })
      .catch((error) => {
        bootstrapPromise = null;
        throw error;
      });
  }
  return bootstrapPromise;
}
