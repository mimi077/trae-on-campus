"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  BadgeCheck,
  Building2,
  CalendarDays,
  GraduationCap,
  IdCard,
  KeyRound,
  Loader2,
  LogOut,
  PackageOpen,
  Save,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { BackLink } from "@/components/back-link";
import { PageHeader } from "@/components/pagination";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import {
  AVATAR_OPTIONS,
  COLLEGES,
  GRADES,
  avatarClassOf,
} from "@/lib/constants";
import { formatSectionRange } from "@/lib/rules/timetable";
import { cn } from "@/lib/utils";
import { api } from "@/trpc/react";

const CUSTOM_COLLEGE = "__custom__";

export default function ProfilePage() {
  const utils = api.useUtils();
  const meQuery = api.auth.me.useQuery();
  const me = meQuery.data;

  const [form, setForm] = useState({
    name: "",
    studentNo: "",
    college: "",
    major: "",
    grade: "",
    bio: "",
    avatarColor: "mint",
  });
  const [customCollege, setCustomCollege] = useState(false);
  const [profileMessage, setProfileMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(
    null,
  );

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [passwordMessage, setPasswordMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(
    null,
  );

  useEffect(() => {
    if (!me) return;
    const college = me.college ?? "";
    const isPreset = (COLLEGES as readonly string[]).includes(college);
    setForm({
      name: me.name,
      studentNo: me.studentNo ?? "",
      college: isPreset ? college : college || COLLEGES[0],
      major: me.major ?? "",
      grade: me.grade ?? "",
      bio: me.bio ?? "",
      avatarColor: me.avatarColor ?? "mint",
    });
    setCustomCollege(Boolean(college) && !isPreset);
  }, [me?.id]);

  const updateProfile = api.auth.updateProfile.useMutation();
  const changePassword = api.auth.changePassword.useMutation();
  const timetableQuery = api.timetable.list.useQuery(undefined, {
    enabled: me?.role === "USER",
    staleTime: 60_000,
  });
  const courses = timetableQuery.data?.courses ?? [];
  const dayOfWeek = new Date().getDay();
  const todayWeekday = dayOfWeek === 0 ? 7 : dayOfWeek;
  const todayCourses = courses.filter((course) => course.weekday === todayWeekday);

  const collegeOptions = Array.from(
    new Set<string>([...COLLEGES, form.college].filter(Boolean)),
  ).map((college) => ({ value: college, label: college }));
  collegeOptions.push({ value: CUSTOM_COLLEGE, label: "其他（手动填写）" });

  const gradeOptions = Array.from(new Set<string>([...GRADES, form.grade].filter(Boolean))).map(
    (grade) => ({ value: grade, label: grade }),
  );

  const handleProfileSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setProfileMessage(null);
    try {
      await updateProfile.mutateAsync({
        name: form.name.trim(),
        studentNo: form.studentNo.trim(),
        college: form.college.trim(),
        major: form.major.trim(),
        grade: form.grade.trim(),
        bio: form.bio.trim(),
        avatarColor: form.avatarColor as (typeof AVATAR_OPTIONS)[number]["key"],
      });
      await utils.auth.me.invalidate();
      setProfileMessage({ tone: "ok", text: "资料已保存，顶栏与商品发布人已同步更新。" });
    } catch (error) {
      setProfileMessage({
        tone: "error",
        text: error instanceof Error ? error.message : "保存失败，请稍后重试",
      });
    }
  };

  const handlePasswordSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setPasswordMessage(null);
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordMessage({ tone: "error", text: "两次输入的新密码不一致" });
      return;
    }
    if (!/^(?=.*[A-Za-z])(?=.*\d).{8,32}$/.test(passwordForm.newPassword)) {
      setPasswordMessage({ tone: "error", text: "新密码需为 8-32 位，且同时包含字母与数字" });
      return;
    }
    try {
      await changePassword.mutateAsync(passwordForm);
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setPasswordMessage({ tone: "ok", text: "密码已更新，下次登录请使用新密码。" });
    } catch (error) {
      setPasswordMessage({
        tone: "error",
        text: error instanceof Error ? error.message : "修改失败，请稍后重试",
      });
    }
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  };

  if (meQuery.isLoading || !me) {
    return <div className="h-72 animate-pulse rounded-3xl bg-white/50" />;
  }

  return (
    <div className="space-y-6">
      <BackLink href="/" label="返回广场" />
      <PageHeader
        title="个人中心"
        description="维护学号、姓名与学院信息，修改登录密码。资料会同步展示在商品详情与聊天会话中。"
      />

      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary-soft/90 via-white/60 to-accent/60 p-6 soft-shadow sm:p-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <span
            className={cn(
              "grid h-20 w-20 shrink-0 place-items-center rounded-[28px] bg-gradient-to-br text-2xl font-semibold text-white shadow-[0_20px_36px_-22px_rgba(14,143,116,0.9)]",
              avatarClassOf(form.avatarColor),
            )}
          >
            {me.name.slice(0, 1)}
          </span>
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-2xl font-semibold tracking-tight">{me.name}</h2>
              <Badge variant={me.isAdmin ? "peach" : "default"} className="gap-1">
                {me.isAdmin ? <ShieldCheck className="h-3 w-3" /> : <BadgeCheck className="h-3 w-3" />}
                {me.isAdmin ? "管理员" : "普通用户"}
              </Badge>
              {me.role === "USER" ? (
                <Badge
                  variant="outline"
                  className={cn(
                    "gap-1",
                    me.authStatus === "AUTHED"
                      ? "border-primary/30 bg-primary-soft/70 text-primary"
                      : "border-amber-200 bg-amber-50 text-amber-700",
                  )}
                >
                  {me.authStatus === "AUTHED" ? "身份已认证" : "身份未认证"}
                </Badge>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <IdCard className="h-3.5 w-3.5" />
                学号 {me.studentNo ?? "未填写"}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5" />
                {me.college ?? "未填写学院"}
                {me.major ? ` · ${me.major}` : ""}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <GraduationCap className="h-3.5 w-3.5" />
                {me.grade ?? "未填写年级"}
                {me.className ? ` · ${me.className}` : ""}
              </span>
            </div>
            <p className="max-w-xl text-sm leading-6 text-muted-foreground">
              {me.bio || "还没有填写简介，介绍一下自己吧。"}
            </p>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          {me.role === "USER" ? (
            <Link href="/profile/auth">
              <Button variant="outline" size="sm" className="gap-1.5">
                <BadgeCheck className="h-3.5 w-3.5" />
                {me.authStatus === "AUTHED" ? "身份认证信息" : "完成身份认证"}
              </Button>
            </Link>
          ) : null}
          <Link href="/my-items">
            <Button variant="outline" size="sm" className="gap-1.5">
              <PackageOpen className="h-3.5 w-3.5" />
              我的发布
            </Button>
          </Link>
          {me.role === "USER" ? (
            <Link href="/profile/timetable">
              <Button variant="outline" size="sm" className="gap-1.5">
                <CalendarDays className="h-3.5 w-3.5" />
                我的课表
              </Button>
            </Link>
          ) : null}
          <Link href="/messages">
            <Button variant="outline" size="sm" className="gap-1.5">
              <UserRound className="h-3.5 w-3.5" />
              我的消息
            </Button>
          </Link>
          <Button variant="ghost" size="sm" className="gap-1.5" onClick={handleLogout}>
            <LogOut className="h-3.5 w-3.5" />
            退出登录
          </Button>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
        <section className="rounded-3xl bg-white/55 p-6 backdrop-blur-sm">
          <div className="mb-5 flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-primary-soft text-primary">
              <UserRound className="h-4 w-4" />
            </span>
            <div>
              <h3 className="text-base font-semibold">编辑资料</h3>
              <p className="text-xs text-muted-foreground">学号同时是登录账号，修改后请用新学号登录。</p>
            </div>
          </div>

          <form onSubmit={handleProfileSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="profile-name" required>
                  姓名
                </Label>
                <Input
                  id="profile-name"
                  value={form.name}
                  onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                  maxLength={20}
                />
              </div>
              <div>
                <Label htmlFor="profile-studentNo" required>
                  学号
                </Label>
                <Input
                  id="profile-studentNo"
                  value={form.studentNo}
                  onChange={(event) => setForm((prev) => ({ ...prev, studentNo: event.target.value }))}
                  maxLength={20}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>学院</Label>
                <Select
                  value={customCollege ? CUSTOM_COLLEGE : form.college}
                  onChange={(value) => {
                    if (value === CUSTOM_COLLEGE) {
                      setCustomCollege(true);
                      return;
                    }
                    setCustomCollege(false);
                    setForm((prev) => ({ ...prev, college: value }));
                  }}
                  options={collegeOptions}
                  ariaLabel="学院"
                />
                {customCollege ? (
                  <Input
                    className="mt-2"
                    value={form.college}
                    onChange={(event) => setForm((prev) => ({ ...prev, college: event.target.value }))}
                    placeholder="请输入学院全称"
                    maxLength={30}
                  />
                ) : null}
              </div>
              <div>
                <Label>年级</Label>
                <Select
                  value={form.grade}
                  onChange={(value) => setForm((prev) => ({ ...prev, grade: value }))}
                  options={[{ value: "", label: "未填写" }, ...gradeOptions]}
                  ariaLabel="年级"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="profile-major">专业</Label>
              <Input
                id="profile-major"
                value={form.major}
                onChange={(event) => setForm((prev) => ({ ...prev, major: event.target.value }))}
                placeholder="如：软件工程"
                maxLength={30}
              />
            </div>

            <div>
              <Label htmlFor="profile-bio">个人简介</Label>
              <Textarea
                id="profile-bio"
                value={form.bio}
                onChange={(event) => setForm((prev) => ({ ...prev, bio: event.target.value }))}
                placeholder="介绍一下自己，或写一句交易偏好"
                maxLength={120}
                className="min-h-[88px]"
              />
              <p className="mt-1 text-right text-[11px] text-muted-foreground">{form.bio.length}/120</p>
            </div>

            <div>
              <Label>头像配色</Label>
              <div className="flex flex-wrap gap-2.5">
                {AVATAR_OPTIONS.map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => setForm((prev) => ({ ...prev, avatarColor: option.key }))}
                    className={cn(
                      "grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br text-xs font-medium text-white transition-all",
                      option.className,
                      form.avatarColor === option.key
                        ? "ring-2 ring-primary ring-offset-2 ring-offset-[#FAF7F3]"
                        : "opacity-75 hover:opacity-100",
                    )}
                    aria-label={option.label}
                    title={option.label}
                  >
                    {option.label.slice(0, 1)}
                  </button>
                ))}
              </div>
            </div>

            {profileMessage ? (
              <p
                className={cn(
                  "rounded-2xl px-4 py-2.5 text-sm",
                  profileMessage.tone === "ok"
                    ? "bg-primary-soft text-primary-dark"
                    : "bg-[#FFE9E4] text-[#C4473A]",
                )}
              >
                {profileMessage.text}
              </p>
            ) : null}

            <Button type="submit" className="gap-1.5" disabled={updateProfile.isPending}>
              {updateProfile.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              保存资料
            </Button>
          </form>
        </section>

        <section className="space-y-5">
          {me.role === "USER" ? (
            <div className="rounded-3xl bg-white/55 p-6 backdrop-blur-sm">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="grid h-8 w-8 place-items-center rounded-xl bg-primary-soft text-primary">
                    <CalendarDays className="h-4 w-4" />
                  </span>
                  <div>
                    <h3 className="text-base font-semibold">我的课表</h3>
                    <p className="text-xs text-muted-foreground">
                      {timetableQuery.isLoading ? "正在加载…" : `已导入 ${courses.length} 门课程`}
                    </p>
                  </div>
                </div>
                <Link href="/profile/timetable">
                  <Button variant="ghost" size="sm" className="gap-1">
                    查看
                  </Button>
                </Link>
              </div>

              {timetableQuery.isLoading ? (
                <div className="h-16 animate-pulse rounded-2xl bg-white/60" />
              ) : courses.length === 0 ? (
                <div className="rounded-2xl bg-white/55 px-4 py-3 text-xs leading-6 text-muted-foreground">
                  还没有导入课表。
                  <Link href="/profile/timetable" className="ml-1 text-primary hover:underline">
                    去导入
                  </Link>
                </div>
              ) : todayCourses.length === 0 ? (
                <p className="rounded-2xl bg-white/55 px-4 py-3 text-xs text-muted-foreground">今天没有课程安排。</p>
              ) : (
                <ul className="space-y-2">
                  {todayCourses.map((course) => (
                    <li
                      key={course.id}
                      className="flex items-center gap-2.5 rounded-2xl bg-white/60 px-3 py-2 text-xs"
                    >
                      <span className="shrink-0 rounded-full bg-primary-soft px-2 py-0.5 text-[10px] font-medium text-primary">
                        {formatSectionRange(course.startSection, course.endSection)}
                      </span>
                      <span className="min-w-0 flex-1 truncate font-medium text-foreground">{course.name}</span>
                      <span className="shrink-0 text-[11px] text-muted-foreground">{course.location ?? ""}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}

          <div className="rounded-3xl bg-white/55 p-6 backdrop-blur-sm">
            <div className="mb-5 flex items-center gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-xl bg-accent/80 text-peach-foreground">
                <KeyRound className="h-4 w-4" />
              </span>
              <div>
                <h3 className="text-base font-semibold">修改密码</h3>
                <p className="text-xs text-muted-foreground">8-32 位，需同时包含字母与数字。</p>
              </div>
            </div>

            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div>
                <Label htmlFor="current-password" required>
                  当前密码
                </Label>
                <Input
                  id="current-password"
                  type="password"
                  value={passwordForm.currentPassword}
                  onChange={(event) =>
                    setPasswordForm((prev) => ({ ...prev, currentPassword: event.target.value }))
                  }
                  autoComplete="current-password"
                />
              </div>
              <div>
                <Label htmlFor="new-password" required>
                  新密码
                </Label>
                <Input
                  id="new-password"
                  type="password"
                  value={passwordForm.newPassword}
                  onChange={(event) =>
                    setPasswordForm((prev) => ({ ...prev, newPassword: event.target.value }))
                  }
                  autoComplete="new-password"
                />
              </div>
              <div>
                <Label htmlFor="confirm-password" required>
                  确认新密码
                </Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={passwordForm.confirmPassword}
                  onChange={(event) =>
                    setPasswordForm((prev) => ({ ...prev, confirmPassword: event.target.value }))
                  }
                  autoComplete="new-password"
                />
              </div>

              {passwordMessage ? (
                <p
                  className={cn(
                    "rounded-2xl px-4 py-2.5 text-sm",
                    passwordMessage.tone === "ok"
                      ? "bg-primary-soft text-primary-dark"
                      : "bg-[#FFE9E4] text-[#C4473A]",
                  )}
                >
                  {passwordMessage.text}
                </p>
              ) : null}

              <Button type="submit" variant="peach" className="w-full gap-1.5" disabled={changePassword.isPending}>
                {changePassword.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <KeyRound className="h-4 w-4" />
                )}
                更新密码
              </Button>
            </form>
          </div>

          <div className="rounded-3xl bg-white/45 p-5 text-xs leading-6 text-muted-foreground backdrop-blur-sm">
            <p className="mb-1 text-sm font-medium text-foreground">账号安全说明</p>
            <p>当前使用 httpOnly Cookie 会话，有效期 7 天；退出登录后服务端会话立即失效。</p>
            <p className="mt-2">测试阶段提供普通用户与管理员两个入口，可分别登录体验不同权限。</p>
          </div>
        </section>
      </div>
    </div>
  );
}
