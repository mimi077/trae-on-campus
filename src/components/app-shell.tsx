"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  Bell,
  BadgeCheck,
  CalendarCheck2,
  CalendarDays,
  ChevronDown,
  ClipboardList,
  Flame,
  Heart,
  HeartHandshake,
  LogOut,
  MapPin,
  Megaphone,
  Menu,
  MessageSquare,
  PackageOpen,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Search,
  ShieldAlert,
  Store,
  Sparkles,
  UserRound,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { DeadlinePopup } from "@/components/deadline-popup";
import { usePublishDialog } from "@/components/publish-dialog-provider";
import { SIDEBAR_STORAGE_KEY, avatarClassOf } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { api } from "@/trpc/react";

type MenuLink = { label: string; href: string };

const MY_LINKS: MenuLink[] = [
  { label: "个人中心", href: "/profile" },
  { label: "我的课表", href: "/profile/timetable" },
  { label: "学生身份认证", href: "/profile/auth" },
  { label: "我的活动", href: "/my-activities" },
  { label: "我的闲置", href: "/my-items" },
  { label: "我的失物发布", href: "/my-lost-found" },
  { label: "我的求购心愿", href: "/my-wishes" },
  { label: "收藏与意向", href: "/favorites" },
  { label: "善意记录", href: "/gift-records" },
  { label: "消息会话", href: "/messages" },
];

/**
 * 一级导航按「校园事务 / 物品流转 / 我的」组织。
 * 闲置相关入口统一收敛到「物品流转」下，避免一级导航条目过多。
 */
const NAV_MENUS: { label: string; items: MenuLink[]; activePrefixes: string[] }[] = [
  {
    label: "校园事务",
    activePrefixes: ["/activities", "/my-activities", "/lost-found", "/my-lost-found", "/notices"],
    items: [
      { label: "活动广场", href: "/activities" },
      { label: "我的活动", href: "/my-activities" },
      { label: "失物招领", href: "/lost-found" },
      { label: "行政通知", href: "/notices" },
    ],
  },
  {
    label: "物品流转",
    activePrefixes: ["/", "/items", "/wishes", "/my-wishes", "/favorites", "/intent-favorites", "/gift-records", "/my-items"],
    items: [
      { label: "闲置广场", href: "/" },
      { label: "心愿求购", href: "/wishes" },
      { label: "我的闲置", href: "/my-items" },
      { label: "收藏与意向", href: "/favorites" },
      { label: "善意记录", href: "/gift-records" },
    ],
  },
  {
    label: "我的",
    activePrefixes: MY_LINKS.map((link) => link.href),
    items: MY_LINKS,
  },
];

const STAFF_LINKS: (MenuLink & { icon: typeof ShieldAlert })[] = [
  { label: "审核中心（活动 / 失物）", href: "/admin/reviews", icon: CalendarCheck2 },
  { label: "作品专区管理", href: "/admin/works", icon: Sparkles },
  { label: "通知管理", href: "/admin/notices", icon: Megaphone },
];

const ADMIN_LINKS: (MenuLink & { icon: typeof ShieldAlert })[] = [
  { label: "审核中心（活动 / 失物）", href: "/admin/reviews", icon: CalendarCheck2 },
  { label: "作品专区管理", href: "/admin/works", icon: Sparkles },
  { label: "通知管理", href: "/admin/notices", icon: Megaphone },
  { label: "首页热门活动", href: "/admin/hot-activity", icon: Flame },
  { label: "举报处理队列", href: "/admin/reports", icon: ShieldAlert },
  { label: "管理员操作审计日志", href: "/admin/logs", icon: ClipboardList },
];

/** 侧栏按业务域分组：一级标题 + 二级入口 */
const SIDEBAR_GROUPS: { title: string; links: (MenuLink & { icon: typeof Store })[] }[] = [
  {
    title: "校园事务",
    links: [
      { href: "/activities", label: "活动广场", icon: CalendarDays },
      { href: "/my-activities", label: "我的活动", icon: CalendarCheck2 },
      { href: "/lost-found", label: "失物招领", icon: MapPin },
      { href: "/notices", label: "行政通知", icon: Megaphone },
    ],
  },
  {
    title: "物品流转",
    links: [
      { href: "/", label: "闲置广场", icon: Store },
      { href: "/wishes", label: "心愿求购", icon: Sparkles },
      { href: "/my-items", label: "我的闲置", icon: PackageOpen },
      { href: "/favorites", label: "收藏与意向", icon: Heart },
      { href: "/gift-records", label: "善意记录", icon: HeartHandshake },
    ],
  },
  {
    title: "我的",
    links: [
      { href: "/notifications", label: "系统通知", icon: Bell },
      { href: "/profile/timetable", label: "我的课表", icon: CalendarDays },
      { href: "/my-wishes", label: "我的求购心愿", icon: Search },
      { href: "/my-lost-found", label: "我的失物发布", icon: ClipboardList },
      { href: "/messages", label: "消息会话", icon: MessageSquare },
      { href: "/profile/auth", label: "身份认证", icon: BadgeCheck },
      { href: "/profile", label: "个人中心", icon: UserRound },
    ],
  },
];

function isActive(pathname: string, prefixes: string[]) {
  return prefixes.some((prefix) => {
    if (prefix === "/") return pathname === "/" || pathname.startsWith("/items");
    return pathname === prefix || pathname.startsWith(`${prefix}/`);
  });
}

type MeData = {
  id: string;
  name: string;
  role: string;
  avatarColor: string | null;
  isAdmin: boolean;
  isStaff: boolean;
  authenticated: boolean;
};

function UserMenu({ me }: { me: MeData }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.replace("/login");
      router.refresh();
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={cn(
          "flex items-center gap-2 rounded-full py-1 pl-1 pr-2 text-sm transition-colors",
          "hover:bg-gradient-to-r hover:from-primary-soft/70 hover:to-accent/50",
          open && "bg-gradient-to-r from-primary-soft/70 to-accent/50",
        )}
      >
        <span
          className={cn(
            "grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br text-xs font-semibold text-white shadow-[0_8px_18px_-12px_rgba(14,143,116,0.9)]",
            avatarClassOf(me.avatarColor),
          )}
        >
          {me.name.slice(0, 1)}
        </span>
        <span className="hidden max-w-[80px] truncate text-sm text-foreground sm:block">{me.name}</span>
        <ChevronDown
          className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform", open && "rotate-180")}
        />
      </button>

      {open ? (
        <div className="absolute right-0 top-full z-50 mt-2 w-60 animate-pop-in">
          <div className="rounded-2xl bg-gradient-to-b from-white/85 via-card/95 to-primary-soft/40 p-1.5 shadow-[0_26px_60px_-30px_rgba(14,143,116,0.4)] backdrop-blur-2xl">
            <div className="px-3 pb-2 pt-2">
              <p className="truncate text-sm font-semibold text-foreground">{me.name}</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {me.isAdmin
                  ? "管理员 · 可处理举报与审计"
                  : me.isStaff
                    ? "教师 · 活动与失物审核"
                    : "普通用户 · 校园实名"}
              </p>
            </div>
            <div className="fade-divider mx-2 mb-1" />
            {[
              { href: "/profile", label: "个人中心", icon: UserRound },
              { href: "/my-items", label: "我的发布", icon: PackageOpen },
              { href: "/messages", label: "我的消息", icon: MessageSquare },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-gradient-to-r hover:from-primary-soft/80 hover:to-accent/60 hover:text-primary"
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
            <div className="fade-divider mx-2 my-1" />
            <button
              type="button"
              onClick={handleLogout}
              disabled={loggingOut}
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-[#FFE9E4] hover:text-[#C4473A] disabled:opacity-60"
            >
              <LogOut className="h-4 w-4" />
              {loggingOut ? "正在退出…" : "退出登录"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function NavDropdown({
  label,
  items,
  active,
}: {
  label: string;
  items: MenuLink[];
  active: boolean;
}) {
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleEnter = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpen(true), 80);
  };
  const handleLeave = () => {
    if (timer.current) clearTimeout(timer.current);
    setOpen(false);
  };

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  return (
    <div className="relative" onMouseEnter={handleEnter} onMouseLeave={handleLeave}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          "group relative inline-flex items-center gap-1 rounded-full px-3 py-2 text-sm transition-colors",
          active ? "font-medium text-primary" : "text-muted-foreground hover:text-primary",
        )}
        aria-expanded={open}
      >
        {label}
        <ChevronDown
          className={cn("h-3.5 w-3.5 transition-transform duration-200", open && "rotate-180")}
        />
        <span
          className={cn(
            "absolute inset-x-3 bottom-0.5 h-[2px] rounded-full bg-primary transition-opacity",
            active ? "opacity-100" : "opacity-0 group-hover:opacity-50",
          )}
        />
      </button>
      {open ? (
        <div className="absolute left-0 top-full z-50 min-w-[200px] animate-pop-in pt-2">
          <div className="rounded-2xl bg-gradient-to-b from-white/85 via-card/95 to-primary-soft/40 p-1.5 shadow-[0_26px_60px_-30px_rgba(14,143,116,0.4)] backdrop-blur-2xl">
            {items.map((item) => (
              <Link
                key={`${label}-${item.href}`}
                href={item.href}
                onClick={() => setOpen(false)}
                className="block rounded-xl px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-gradient-to-r hover:from-primary-soft/80 hover:to-accent/60 hover:text-primary"
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { openPublish } = usePublishDialog();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const meQuery = api.auth.me.useQuery(undefined, { staleTime: 30_000 });
  const me = meQuery.data;
  const isAdmin = Boolean(me?.isAdmin);
  const isStaff = Boolean(me?.isStaff);
  const expiredQuery = api.item.expiredCount.useQuery(undefined, {
    enabled: Boolean(me?.authenticated),
    staleTime: 60_000,
  });
  const expiredCount = expiredQuery.data?.count ?? 0;
  const lostPendingQuery = api.lostFound.pendingCount.useQuery(undefined, {
    enabled: isStaff,
    staleTime: 60_000,
  });
  const activityPendingQuery = api.activity.pendingCount.useQuery(undefined, {
    enabled: isStaff,
    staleTime: 60_000,
  });
  const noticeUnreadQuery = api.notice.unreadCount.useQuery(undefined, {
    enabled: Boolean(me?.authenticated),
    staleTime: 30_000,
    // 教师发布行政通知后，消息栏铃铛需要在 30 秒内自动刷新未读数
    refetchInterval: 30_000,
  });
  const noticeUnread = noticeUnreadQuery.data?.count ?? 0;
  const systemUnreadQuery = api.notification.unreadCount.useQuery(undefined, {
    enabled: Boolean(me?.authenticated),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
  const systemUnread = systemUnreadQuery.data?.count ?? 0;
  const staffPendingCount = (lostPendingQuery.data?.count ?? 0) + (activityPendingQuery.data?.count ?? 0);
  const totalAlerts = expiredCount + noticeUnread + systemUnread + (isStaff ? staffPendingCount : 0);
  const bellHref =
    systemUnread > 0 || noticeUnread > 0
      ? "/notifications"
      : expiredCount > 0
        ? "/my-items?expired=1"
        : isStaff
          ? "/admin/reviews"
          : "/notifications";
  const bellTitle =
    systemUnread > 0
      ? `${systemUnread} 条系统通知未读，点击查看`
      : noticeUnread > 0
        ? `${noticeUnread} 条行政通知未读，点击查看`
        : expiredCount > 0
          ? `${expiredCount} 件闲置已到期，点击处理`
          : isStaff && staffPendingCount > 0
            ? `${staffPendingCount} 条内容待审核，点击进入审核中心`
            : "暂无待处理提醒";

  useEffect(() => {
    setCollapsed(window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === "1");
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (me && !me.authenticated) {
      router.replace("/login");
    }
  }, [me, router]);

  if (pathname === "/login") {
    return <>{children}</>;
  }

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      window.localStorage.setItem(SIDEBAR_STORAGE_KEY, next ? "1" : "0");
      return next;
    });
  };

  const sidebarContent = (
    <>
      <div className="flex h-16 items-center gap-2 px-4 md:hidden">
        <span className="grid h-8 w-8 place-items-center rounded-xl mint-gradient text-sm font-semibold text-white">
          集
        </span>
        <span className="text-sm font-semibold">校园集</span>
        <button
          type="button"
          className="ml-auto rounded-full p-1.5 text-muted-foreground hover:bg-primary-soft"
          onClick={() => setMobileOpen(false)}
          aria-label="关闭菜单"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto p-3 scrollbar-thin">
        {SIDEBAR_GROUPS.map((group) => (
          <div key={group.title} className="mb-2 space-y-1">
            <p
              className={cn(
                "px-3 pb-1 pt-2 text-[11px] font-medium tracking-wide text-muted-foreground/80",
                collapsed && "md:hidden",
              )}
            >
              {group.title}
            </p>
            {group.links.map((item) => {
              const active =
                item.href === "/"
                  ? pathname === "/" || pathname.startsWith("/items")
                  : pathname === item.href || pathname.startsWith(`${item.href}/`);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={collapsed ? item.label : undefined}
                  className={cn(
                    "relative flex h-10 items-center gap-3 rounded-full px-3 text-sm transition-all",
                    collapsed && "md:justify-center md:px-0",
                    active
                      ? "bg-gradient-to-r from-primary-soft/90 to-transparent font-medium text-primary"
                      : "text-muted-foreground hover:bg-gradient-to-r hover:from-primary-soft/55 hover:to-accent/30 hover:text-foreground",
                  )}
                >
                  {active ? (
                    <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-primary" />
                  ) : null}
                  <Icon className={cn("h-4 w-4 shrink-0", active ? "text-primary" : "")} />
                  <span className={cn("truncate", collapsed && "md:hidden")}>{item.label}</span>
                  {item.href === "/notices" && noticeUnread > 0 ? (
                    <span
                      className={cn(
                        "ml-auto rounded-full bg-peach px-1.5 text-[10px] font-semibold text-peach-foreground",
                        collapsed && "md:hidden",
                      )}
                    >
                      {noticeUnread > 9 ? "9+" : noticeUnread}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </div>
        ))}

        <button
          type="button"
          onClick={openPublish}
          title={collapsed ? "发布闲置" : undefined}
          className={cn(
            "flex h-10 w-full items-center gap-3 rounded-full px-3 text-sm text-muted-foreground transition-all hover:bg-gradient-to-r hover:from-primary-soft/55 hover:to-accent/30 hover:text-foreground",
            collapsed && "md:justify-center md:px-0",
          )}
        >
          <Plus className="h-4 w-4 shrink-0" />
          <span className={cn(collapsed && "md:hidden")}>发布闲置</span>
        </button>

        {isStaff ? (
          <div className="space-y-1 pt-2">
            <div className="fade-divider mx-2 mb-2" />
            <p
              className={cn(
                "px-3 pb-1 text-[11px] font-medium text-muted-foreground",
                collapsed && "md:hidden",
              )}
            >
              管理后台
            </p>
            {(isAdmin ? ADMIN_LINKS : STAFF_LINKS).map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              const Icon = item.icon;
              const badge = item.href === "/admin/reviews" && staffPendingCount > 0 ? staffPendingCount : null;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={collapsed ? item.label : undefined}
                  className={cn(
                    "relative flex h-10 items-center gap-3 rounded-full px-3 text-sm transition-all",
                    collapsed && "md:justify-center md:px-0",
                    active
                      ? "bg-gradient-to-r from-accent/70 to-transparent font-medium text-peach-foreground"
                      : "text-muted-foreground hover:bg-gradient-to-r hover:from-accent/60 hover:to-transparent hover:text-foreground",
                  )}
                >
                  {active ? (
                    <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-peach" />
                  ) : null}
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className={cn("truncate", collapsed && "md:hidden")}>{item.label}</span>
                  {badge ? (
                    <span
                      className={cn(
                        "ml-auto rounded-full bg-peach px-1.5 text-[10px] font-semibold text-peach-foreground",
                        collapsed && "md:hidden",
                      )}
                    >
                      {badge > 9 ? "9+" : badge}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </div>
        ) : null}
      </nav>

      <div className="p-3">
        <div className="fade-divider mx-2 mb-3" />
        <button
          type="button"
          onClick={toggleCollapsed}
          className={cn(
            "hidden h-9 w-full items-center gap-3 rounded-full px-3 text-xs text-muted-foreground transition-colors hover:bg-gradient-to-r hover:from-primary-soft/60 hover:to-accent/30 hover:text-foreground md:flex",
            collapsed && "md:justify-center md:px-0",
          )}
        >
          {collapsed ? (
            <PanelLeftOpen className="h-4 w-4 shrink-0" />
          ) : (
            <PanelLeftClose className="h-4 w-4 shrink-0" />
          )}
          <span className={cn(collapsed && "md:hidden")}>收起侧边栏</span>
        </button>
        <p
          className={cn(
            "mt-2 px-3 text-[11px] leading-5 text-muted-foreground/70",
            collapsed && "md:hidden",
          )}
        >
          校园集 V9 · 事务通知 + 课表 + 闲置
        </p>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-background">
      <header className="fixed inset-x-0 top-0 z-40 h-16 bg-background/80 backdrop-blur-xl shadow-[0_16px_34px_-32px_rgba(14,143,116,0.55)]">
        <div className="flex h-full items-center gap-3 px-4 md:px-6">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="rounded-full p-1.5 text-muted-foreground hover:bg-primary-soft md:hidden"
            aria-label="打开菜单"
          >
            <Menu className="h-5 w-5" />
          </button>

          <Link href="/" className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-xl mint-gradient text-sm font-semibold text-white shadow-[0_10px_20px_-14px_rgba(14,143,116,0.9)]">
              集
            </span>
            <span className="hidden text-sm font-semibold tracking-tight text-foreground sm:block">
              校园集
            </span>
            <span className="hidden rounded-full bg-primary-soft px-2 py-0.5 text-[10px] font-medium text-primary lg:block">
              一站式
            </span>
          </Link>

          <nav className="ml-6 hidden items-center gap-0.5 lg:flex">
            {NAV_MENUS.map((menu) => (
              <NavDropdown
                key={menu.label}
                label={menu.label}
                items={menu.items}
                active={isActive(pathname, menu.activePrefixes)}
              />
            ))}
            {isStaff ? (
              <NavDropdown
                label="管理后台"
                items={isAdmin ? ADMIN_LINKS : STAFF_LINKS}
                active={pathname.startsWith("/admin")}
              />
            ) : null}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <Link
              href={bellHref}
              aria-label={bellTitle}
              title={bellTitle}
              className="relative grid h-9 w-9 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-primary-soft hover:text-primary"
            >
              <Bell className="h-[18px] w-[18px]" />
              {totalAlerts > 0 ? (
                <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-[16px] place-items-center rounded-full bg-peach px-1 text-[10px] font-semibold text-peach-foreground">
                  {totalAlerts > 9 ? "9+" : totalAlerts}
                </span>
              ) : null}
            </Link>
            <Button size="sm" onClick={openPublish} className="gap-1.5 active:scale-[0.97]">
              <Plus className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">发布闲置</span>
              <span className="sm:hidden">发布</span>
            </Button>
            {me ? (
              <UserMenu me={me} />
            ) : (
              <span className="h-8 w-8 animate-pulse rounded-full bg-primary-soft" />
            )}
          </div>
        </div>
      </header>

      <aside
        className={cn(
          "fixed bottom-0 left-0 top-16 z-30 hidden flex-col bg-card/45 backdrop-blur-xl shadow-[18px_0_40px_-38px_rgba(14,143,116,0.5)] transition-[width] duration-200 md:flex",
          collapsed ? "md:w-[76px]" : "md:w-[240px]",
        )}
      >
        {sidebarContent}
      </aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 animate-fade-in bg-[#0E3A32]/30 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute bottom-0 left-0 top-0 flex w-64 animate-slide-up flex-col bg-gradient-to-b from-white/95 via-card/95 to-primary-soft/50 backdrop-blur-2xl shadow-2xl">
            {sidebarContent}
          </aside>
        </div>
      ) : null}

      <main
        className={cn(
          "min-h-screen pt-16 transition-[padding] duration-200",
          collapsed ? "md:pl-[76px]" : "md:pl-[240px]",
        )}
      >
        <div className="mx-auto w-full max-w-6xl px-4 py-6 md:px-8 md:py-8">{children}</div>
      </main>
      {me?.authenticated ? <DeadlinePopup /> : null}
    </div>
  );
}
