import type { PrismaClient } from "@prisma/client";
import { hashPassword } from "./auth";
import {
  SEED_ACTIVITIES,
  SEED_ACTIVITY_MESSAGES,
  SEED_BIDS,
  SEED_FAVORITES,
  SEED_GIFT_APPROVALS,
  SEED_HOT_ACTIVITIES,
  SEED_INTENT_FAVORITES,
  SEED_ITEMS,
  SEED_LOST_FOUND,
  SEED_LOST_FOUND_MESSAGES,
  SEED_MESSAGES,
  SEED_NOTICES,
  SEED_REGISTRATIONS,
  SEED_REPORTS,
  SEED_USERS,
  SEED_WISHES,
  SEED_WORK_CATEGORIES,
  SEED_WORKS,
} from "./seed-data";

/**
 * 幂等初始化：先确保演示身份存在，再在商品表为空时灌入完整演示数据。
 * 本地 `prisma db push` 与线上运行期建表共用这一份逻辑，避免演示数据两套实现。
 */
export async function seedDatabase(db: PrismaClient) {
  for (const user of SEED_USERS) {
    const profile = {
      name: user.name,
      campus: user.campus,
      role: user.role,
      studentNo: user.studentNo,
      passwordHash: hashPassword(user.password),
      email: user.email,
      college: user.college,
      major: user.major,
      grade: user.grade,
      className: user.className ?? null,
      authStatus: user.authStatus ?? (user.role === "USER" ? "UNAUTH" : "AUTHED"),
      bio: user.bio,
      avatarColor: user.avatarColor,
    };
    await db.user.upsert({
      where: { id: user.id },
      update: profile,
      create: { id: user.id, ...profile },
    });
  }

  // 失物招领：独立判定，便于已有旧库在不重置商品数据的前提下补种演示内容
  const lostFoundCount = await db.lostFound.count();
  if (lostFoundCount === 0) {
    const lfNow = Date.now();
    for (const record of SEED_LOST_FOUND) {
      const createdAt = new Date(lfNow - record.minutesAgo * 60_000);
      const reviewed = record.status !== "PENDING";
      await db.lostFound.create({
        data: {
          id: record.id,
          kind: record.kind,
          title: record.title,
          category: record.category,
          location: record.location,
          happenedAt: new Date(lfNow - record.hoursAgo * 3_600_000),
          description: record.description,
          imageUrl: record.imageUrl ?? null,
          contact: record.contact ?? null,
          status: record.status,
          reviewNote: record.reviewNote ?? null,
          reviewedBy: reviewed ? "u_admin" : null,
          reviewedAt: reviewed ? new Date(createdAt.getTime() + 600_000) : null,
          userId: record.userId,
          createdAt,
          updatedAt: createdAt,
        },
      });
    }
    for (const message of SEED_LOST_FOUND_MESSAGES) {
      await db.lostFoundMessage.create({
        data: {
          recordId: message.recordId,
          userId: message.userId,
          content: message.content,
          createdAt: new Date(lfNow - message.minutesAgo * 60_000),
        },
      });
    }
  }

  // 活动事务：独立判定，已有旧库也能补种演示活动而不影响闲置数据
  const activityCount = await db.activity.count();
  if (activityCount === 0) {
    const actNow = Date.now();
    for (const activity of SEED_ACTIVITIES) {
      const startAt = new Date(actNow + activity.startInMinutes * 60_000);
      const createdAt = new Date(actNow - activity.minutesAgo * 60_000);
      const reviewed = activity.status !== "PENDING";
      await db.activity.create({
        data: {
          id: activity.id,
          title: activity.title,
          type: activity.type,
          source: activity.source,
          organizer: activity.organizer,
          startAt,
          endAt: new Date(startAt.getTime() + activity.durationMinutes * 60_000),
          registrationDeadline: new Date(actNow + activity.deadlineInMinutes * 60_000),
          location: activity.location,
          capacity: activity.capacity,
          isUnlimited: activity.isUnlimited ?? false,
          submissionDeadline:
            typeof activity.submissionDeadlineInMinutes === "number"
              ? new Date(actNow + activity.submissionDeadlineInMinutes * 60_000)
              : null,
          showcaseEnabled: activity.showcaseEnabled ?? false,
          registrationMode: activity.registrationMode,
          externalUrl: activity.externalUrl ?? null,
          summary: activity.summary,
          description: activity.description ?? null,
          coverUrl: activity.coverUrl ?? null,
          tags: JSON.stringify(activity.tags),
          creditPoints: activity.creditPoints ?? null,
          publisherContact: activity.publisherContact ?? null,
          qqGroup: activity.qqGroup ?? null,
          targetCollege: JSON.stringify(activity.targetCollege ?? []),
          targetGrade: JSON.stringify(activity.targetGrade ?? []),
          targetMajor: JSON.stringify(activity.targetMajor ?? []),
          targetClass: JSON.stringify(activity.targetClass ?? []),
          status: activity.status,
          reviewNote: activity.reviewNote ?? null,
          reviewedBy: reviewed ? "u_teacher" : null,
          reviewedAt: reviewed ? new Date(createdAt.getTime() + 3_600_000) : null,
          createdBy: activity.createdBy,
          createdAt,
          updatedAt: createdAt,
        },
      });
    }
    for (const registration of SEED_REGISTRATIONS) {
      await db.registration.create({
        data: {
          activityId: registration.activityId,
          userId: registration.userId,
          status: registration.status,
          createdAt: new Date(actNow - registration.minutesAgo * 60_000),
          updatedAt: new Date(actNow - registration.minutesAgo * 60_000),
        },
      });
    }
    for (const message of SEED_ACTIVITY_MESSAGES) {
      await db.activityMessage.create({
        data: {
          activityId: message.activityId,
          userId: message.userId,
          content: message.content,
          createdAt: new Date(actNow - message.minutesAgo * 60_000),
        },
      });
    }
  }

  // V8 作品展示专区：独立判定，旧库可补种演示作品
  const workCategoryCount = await db.workCategory.count();
  if (workCategoryCount === 0) {
    const showcaseActivity = await db.activity.findUnique({
      where: { id: "act_programming_contest" },
      select: { id: true },
    });
    if (showcaseActivity) {
      const workNow = Date.now();
      for (const category of SEED_WORK_CATEGORIES) {
        await db.workCategory.create({
          data: {
            id: category.id,
            activityId: category.activityId,
            name: category.name,
            sortOrder: category.sortOrder,
          },
        });
      }
      for (const work of SEED_WORKS) {
        const createdAt = new Date(workNow - work.minutesAgo * 60_000);
        await db.showcaseWork.create({
          data: {
            id: work.id,
            activityId: work.activityId,
            categoryId: work.categoryId,
            createdBy: work.createdBy,
            authorName: work.authorName,
            title: work.title,
            description: work.description,
            workUrl: work.workUrl ?? null,
            coverUrl: work.coverUrl ?? null,
            media: JSON.stringify(work.media),
            status: work.status,
            featured: work.featured ?? false,
            pinned: work.pinned ?? false,
            sortOrder: work.sortOrder ?? 0,
            createdAt,
            updatedAt: createdAt,
          },
        });
      }
    }
  }

  // 行政通知：独立判定，旧库可补种
  const noticeCount = await db.adminNotice.count();
  if (noticeCount === 0) {
    const noticeNow = Date.now();
    for (const notice of SEED_NOTICES) {
      await db.adminNotice.create({
        data: {
          id: notice.id,
          title: notice.title,
          content: notice.content,
          dept: notice.dept,
          targetCollege: notice.targetCollege ?? null,
          targetGrade: notice.targetGrade ?? null,
          targetMajor: notice.targetMajor ?? null,
          targetClass: notice.targetClass ?? null,
          createdBy: notice.createdBy,
          createdAt: new Date(noticeNow - notice.minutesAgo * 60_000),
        },
      });
    }
  }

  // 首页热门活动池：独立判定
  const hotCount = await db.hotActivity.count();
  if (hotCount === 0) {
    const hotNow = Date.now();
    for (const hot of SEED_HOT_ACTIVITIES) {
      await db.hotActivity.create({
        data: {
          sortOrder: hot.sortOrder,
          isExternal: hot.isExternal ?? false,
          externalUrl: hot.externalUrl ?? null,
          activityId: hot.activityId ?? null,
          title: hot.title,
          coverUrl: hot.coverUrl ?? null,
          createdAt: new Date(hotNow - hot.minutesAgo * 60_000),
        },
      });
    }
  }

  const count = await db.item.count();
  if (count > 0) return;

  const now = Date.now();
  const at = (minutesAgo: number) => new Date(now - minutesAgo * 60_000);

  const dealTagSets: string[][] = [
    ["急出"],
    ["可小刀", "可换物"],
    ["只自提"],
    [],
    ["可换物"],
    ["急出", "只自提"],
  ];

  for (const [index, item] of SEED_ITEMS.entries()) {
    const createdAt = at(item.minutesAgo);
    const expiresAt = new Date(createdAt.getTime() + 14 * 24 * 60 * 60 * 1000);
    await db.item.create({
      data: {
        id: item.id,
        title: item.title,
        category: item.category,
        sceneTags: JSON.stringify(item.sceneTags),
        dealTags: JSON.stringify(dealTagSets[index % dealTagSets.length]),
        isGift: item.isGift ?? false,
        bargainMode: item.bargainMode ?? "FREE_BARGAIN",
        isbn: item.isbn ?? null,
        price: item.price,
        description: item.description,
        imageUrl: item.imageUrl,
        status: item.status,
        expiresAt,
        userId: item.userId,
        createdAt,
        updatedAt: createdAt,
      },
    });
  }

  for (const favorite of SEED_FAVORITES) {
    await db.favorite.create({
      data: {
        userId: favorite.userId,
        itemId: favorite.itemId,
        createdAt: at(favorite.minutesAgo),
      },
    });
  }

  for (const favorite of SEED_INTENT_FAVORITES) {
    await db.intentFavorite.create({
      data: {
        userId: favorite.userId,
        itemId: favorite.itemId,
        createdAt: at(favorite.minutesAgo),
      },
    });
  }

  for (const wish of SEED_WISHES) {
    await db.wishPurchase.create({
      data: {
        id: wish.id,
        userId: wish.userId,
        title: wish.title,
        category: wish.category,
        expectPrice: wish.expectPrice,
        description: wish.description,
        expireAt: new Date(now + wish.daysUntilExpire * 86_400_000),
        isActive: wish.isActive ?? true,
        createdAt: at(wish.minutesAgo),
      },
    });
  }

  for (const bid of SEED_BIDS) {
    await db.bid.create({
      data: {
        id: bid.id,
        itemId: bid.itemId,
        userId: bid.userId,
        price: bid.price,
        status: bid.status,
        createdAt: at(bid.minutesAgo),
      },
    });
  }

  for (const approval of SEED_GIFT_APPROVALS) {
    await db.giftApproval.create({
      data: {
        giftItemId: approval.giftItemId,
        userId: approval.userId,
        createdAt: at(approval.minutesAgo),
      },
    });
  }

  for (const message of SEED_MESSAGES) {
    await db.message.create({
      data: {
        fromUserId: message.fromUserId,
        toUserId: message.toUserId,
        content: message.content,
        relatedItemId: message.relatedItemId ?? null,
        relatedWishId: message.relatedWishId ?? null,
        createdAt: at(message.minutesAgo),
      },
    });
  }

  for (const report of SEED_REPORTS) {
    await db.report.create({
      data: {
        reporterUserId: report.reporterUserId,
        targetItemId: report.targetItemId ?? null,
        targetWishId: report.targetWishId ?? null,
        reason: report.reason,
        status: report.status,
        createdAt: at(report.minutesAgo),
      },
    });
  }
}
