import { createTRPCRouter } from "@/server/api/trpc";
import { activityRouter } from "@/server/api/routers/activity";
import { activityMessageRouter } from "@/server/api/routers/activity-message";
import { adminRouter } from "@/server/api/routers/admin";
import { aiRouter } from "@/server/api/routers/ai";
import { authRouter } from "@/server/api/routers/auth";
import { bidRouter } from "@/server/api/routers/bid";
import { favoriteRouter } from "@/server/api/routers/favorite";
import { giftRouter } from "@/server/api/routers/gift";
import { hotActivityRouter } from "@/server/api/routers/hot-activity";
import { intentFavoriteRouter } from "@/server/api/routers/intent-favorite";
import { itemRouter } from "@/server/api/routers/item";
import { lostFoundRouter } from "@/server/api/routers/lost-found";
import { messageRouter } from "@/server/api/routers/message";
import { noticeRouter } from "@/server/api/routers/notice";
import { notificationRouter } from "@/server/api/routers/notification";
import { registrationRouter } from "@/server/api/routers/registration";
import { reminderRouter } from "@/server/api/routers/reminder";
import { reportRouter } from "@/server/api/routers/report";
import { showcaseRouter } from "@/server/api/routers/showcase";
import { statsRouter } from "@/server/api/routers/stats";
import { timetableRouter } from "@/server/api/routers/timetable";
import { wishRouter } from "@/server/api/routers/wish";

export const appRouter = createTRPCRouter({
  auth: authRouter,
  stats: statsRouter,
  item: itemRouter,
  favorite: favoriteRouter,
  intentFavorite: intentFavoriteRouter,
  wish: wishRouter,
  lostFound: lostFoundRouter,
  activity: activityRouter,
  registration: registrationRouter,
  activityMessage: activityMessageRouter,
  notice: noticeRouter,
  notification: notificationRouter,
  timetable: timetableRouter,
  ai: aiRouter,
  showcase: showcaseRouter,
  reminder: reminderRouter,
  hotActivity: hotActivityRouter,
  bid: bidRouter,
  gift: giftRouter,
  message: messageRouter,
  report: reportRouter,
  admin: adminRouter,
});

export type AppRouter = typeof appRouter;
