import type { Metadata } from "next";
import "./globals.css";
import { AppShell } from "@/components/app-shell";
import { PublishDialogProvider } from "@/components/publish-dialog-provider";
import { TRPCReactProvider } from "@/trpc/react";

export const metadata: Metadata = {
  title: "校园集 V9 · 校园活动与事务平台",
  description:
    "校园集 V9：一站式校园事务平台，支持活动发布与报名、竞赛作品专区、教师行政通知与定时发布、学生课表导入、闲置二手与失物招领。",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <TRPCReactProvider>
          <PublishDialogProvider>
            <AppShell>{children}</AppShell>
          </PublishDialogProvider>
        </TRPCReactProvider>
      </body>
    </html>
  );
}
