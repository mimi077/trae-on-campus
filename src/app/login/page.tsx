"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Eye,
  EyeOff,
  GraduationCap,
  Loader2,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
  UserRound,
  Briefcase,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { DEMO_ACCOUNTS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { api } from "@/trpc/react";

const HERO_IMAGE =
  "https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=" +
  encodeURIComponent(
    "warm sunlit university campus main building with red brick and green lawn, tall trees, soft mint sky, bright airy architectural photography, wide angle",
  ) +
  "&image_size=landscape_16_9";

type Role = "USER" | "TEACHER" | "ADMIN";

export default function LoginPage() {
  const router = useRouter();
  const statsQuery = api.stats.overview.useQuery(undefined, { staleTime: 60_000 });

  const [role, setRole] = useState<Role>("USER");
  const [studentNo, setStudentNo] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const demo =
    role === "ADMIN" ? DEMO_ACCOUNTS.admin : role === "TEACHER" ? DEMO_ACCOUNTS.teacher : DEMO_ACCOUNTS.user;
  const stats = statsQuery.data;

  const switchRole = (next: Role) => {
    setRole(next);
    setError(null);
    setStudentNo("");
    setPassword("");
  };

  const fillDemo = () => {
    setStudentNo(demo.studentNo);
    setPassword(demo.password);
    setError(null);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (loading) return;
    setError(null);

    if (!studentNo.trim() || !password) {
      setError("请输入学号与密码");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentNo: studentNo.trim(), password, expectRole: role }),
      });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        setError(data?.error ?? "登录失败，请稍后重试");
        return;
      }
      router.replace("/activities");
      router.refresh();
    } catch {
      setError("网络异常，请稍后重试");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="warm-mesh min-h-screen">
      <div className="mx-auto grid min-h-screen w-full max-w-6xl items-center gap-10 px-5 py-8 lg:grid-cols-[1.04fr_0.96fr] lg:px-8 lg:py-12">
        <section className="space-y-7">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-2xl mint-gradient text-base font-semibold text-white shadow-[0_14px_28px_-16px_rgba(14,143,116,0.8)]">
              集
            </span>
            <div>
              <p className="text-base font-semibold tracking-tight">校园集 V9 · 校园活动与事务平台</p>
              <p className="text-xs text-muted-foreground">Campus Hub · Activities First</p>
            </div>
          </div>

          <div className="space-y-4">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/60 px-3.5 py-1.5 text-xs font-medium text-primary backdrop-blur">
              <Sparkles className="h-3.5 w-3.5" />
              同校实名 · 闲置流转 · 活动报名
            </span>
            <h1 className="text-4xl font-bold leading-[1.15] tracking-tight sm:text-5xl">
              一个学号，
              <span className="text-gradient-mint">发现活动</span>
              <br />
              也把闲置流转
            </h1>
            <p className="max-w-lg text-sm leading-7 text-muted-foreground sm:text-base">
              讲座、竞赛、志愿与社团活动在这里发布、筛选与报名，行政通知按学院和班级定向送达；课本、台灯与球拍也可以继续流转。登录后即可发布闲置、找失物、报名活动。
            </p>
          </div>

          <div className="relative overflow-hidden rounded-[32px] shadow-[0_40px_80px_-46px_rgba(14,143,116,0.65)]">
            <img
              src={HERO_IMAGE}
              alt="校园风光"
              className="h-56 w-full object-cover sm:h-72"
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0E3A32]/55 via-transparent to-transparent" />
            <div className="absolute inset-x-4 bottom-4 grid grid-cols-3 gap-2 rounded-2xl bg-white/25 p-3 text-white backdrop-blur-md sm:inset-x-5 sm:bottom-5">
              {[
                { value: stats?.onSale ?? "—", label: "在售闲置" },
                { value: stats?.members ?? "—", label: "注册同学" },
                { value: stats?.gifts ?? "—", label: "善意赠予" },
              ].map((item) => (
                <div key={item.label} className="text-center">
                  <p className="text-xl font-semibold leading-7">{item.value}</p>
                  <p className="text-[11px] text-white/80">{item.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section>
          <div className="glass-strong soft-shadow rounded-[32px] p-6 sm:p-8">
            <div className="space-y-1.5">
              <h2 className="text-xl font-semibold tracking-tight">欢迎回来</h2>
              <p className="text-sm text-muted-foreground">
                学生使用学号、教师使用工号登录；测试阶段三类账号均可直接体验。
              </p>
            </div>

            <div className="mt-6 grid grid-cols-3 gap-1 rounded-full bg-white/45 p-1 backdrop-blur">
              {[
                { key: "USER" as const, label: "学生", icon: UserRound },
                { key: "TEACHER" as const, label: "教师", icon: Briefcase },
                { key: "ADMIN" as const, label: "管理员", icon: ShieldCheck },
              ].map((tab) => {
                const active = role === tab.key;
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => switchRole(tab.key)}
                    className={cn(
                      "inline-flex h-9 items-center justify-center gap-1.5 rounded-full text-sm transition-all",
                      active
                        ? "mint-gradient font-medium text-white shadow-[0_10px_20px_-14px_rgba(14,143,116,0.9)]"
                        : "text-muted-foreground hover:text-primary",
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {tab.label}
                  </button>
                );
              })}
            </div>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div>
                <Label htmlFor="studentNo" required>
                  学号 / 账号
                </Label>
                <div className="relative">
                  <GraduationCap className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/70" />
                  <Input
                    id="studentNo"
                    value={studentNo}
                    onChange={(event) => setStudentNo(event.target.value)}
                    placeholder={role === "ADMIN" ? "请输入管理员账号" : role === "TEACHER" ? "请输入教师工号" : "请输入学号"}
                    autoComplete="username"
                    className="pl-10"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="password" required>
                  密码
                </Label>
                <div className="relative">
                  <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/70" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="请输入密码"
                    autoComplete="current-password"
                    className="pl-10 pr-11"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? "隐藏密码" : "显示密码"}
                    className="absolute right-2.5 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-primary-soft hover:text-primary"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {error ? (
                <p className="rounded-2xl bg-[#FFE9E4] px-4 py-2.5 text-sm text-[#C4473A]">{error}</p>
              ) : null}

              <Button type="submit" size="lg" className="w-full gap-2" disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {loading ? "正在登录…" : "登录"}
                {loading ? null : <ArrowRight className="h-4 w-4" />}
              </Button>
            </form>

            <div className="mt-5 rounded-2xl bg-gradient-to-r from-primary-soft/80 via-white/40 to-accent/60 p-3.5">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-primary">测试演示账号</p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {demo.name} · 学号 {demo.studentNo} · 密码 {demo.password}
                  </p>
                </div>
                <Button type="button" variant="subtle" size="sm" onClick={fillDemo} className="shrink-0">
                  一键填入
                </Button>
              </div>
            </div>

            <p className="mt-5 text-center text-[11px] leading-5 text-muted-foreground/80">
              登录即表示同意校园闲置的实名交易约定：仅限校内面交，禁止发布违规物品。
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
