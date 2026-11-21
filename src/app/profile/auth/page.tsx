"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BadgeCheck, Loader2, ShieldQuestion, Sparkles } from "lucide-react";
import { BackLink } from "@/components/back-link";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { CLASS_OPTIONS, COLLEGES, GRADES } from "@/lib/constants";
import { api } from "@/trpc/react";

export default function ProfileAuthPage() {
  const utils = api.useUtils();
  const meQuery = api.auth.me.useQuery();
  const me = meQuery.data;
  const submit = api.auth.submitProfileAuth.useMutation();

  const [college, setCollege] = useState<string>("");
  const [grade, setGrade] = useState<string>("");
  const [major, setMajor] = useState("");
  const [className, setClassName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!me) return;
    setCollege(me.college ?? "");
    setGrade(me.grade ?? "");
    setMajor(me.major ?? "");
    setClassName(me.className ?? "");
  }, [me]);

  if (!meQuery.isLoading && me && me.role !== "USER") {
    return (
      <div className="space-y-4">
        <BackLink href="/profile" label="返回个人中心" />
        <div className="rounded-3xl bg-white/60 p-6 text-sm text-muted-foreground">
          教师与管理员账号无需学生身份认证。
        </div>
      </div>
    );
  }

  const authed = me?.authStatus === "AUTHED";

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!college || !grade) {
      setError("请选择学院与年级");
      return;
    }
    try {
      await submit.mutateAsync({ college, grade, major: major.trim(), className: className.trim() });
      await Promise.all([utils.auth.me.invalidate(), utils.activity.recommended.invalidate()]);
      setDone(true);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "提交失败，请稍后重试");
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <BackLink href="/profile" label="返回个人中心" />

      <section className="rounded-3xl bg-gradient-to-br from-primary-soft/80 via-white/60 to-accent/50 p-6 sm:p-8">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/70 px-3 py-1 text-xs font-medium text-primary">
          {authed ? <BadgeCheck className="h-3.5 w-3.5" /> : <ShieldQuestion className="h-3.5 w-3.5" />}
          {authed ? "已完成身份认证" : "待完成身份认证"}
        </span>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">学生身份认证</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          填写学院、年级、专业与班级后，首页「为你推荐」会按你的身份匹配活动，学院 / 班级定向通知也才会送达。
          身份信息仅用于推荐与通知筛选，不会展示给其他同学。
        </p>
      </section>

      {done ? (
        <section className="space-y-4 rounded-3xl bg-white/65 p-6">
          <p className="inline-flex items-center gap-2 text-sm font-medium text-primary">
            <BadgeCheck className="h-4 w-4" />
            认证信息已保存
          </p>
          <p className="text-sm leading-6 text-muted-foreground">
            现在可以返回首页查看「为你推荐」，或去活动广场按时间与类型筛选活动。
          </p>
          <div className="flex flex-wrap gap-2">
            <Link href="/">
              <Button className="gap-1.5">
                <Sparkles className="h-4 w-4" />
                查看为你推荐
              </Button>
            </Link>
            <Link href="/activities">
              <Button variant="outline">去活动广场</Button>
            </Link>
          </div>
        </section>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4 rounded-3xl bg-white/65 p-6">
          {authed ? (
            <p className="rounded-2xl bg-primary-soft/60 px-4 py-3 text-xs leading-5 text-primary">
              你已提交过认证信息，如需调整学院 / 班级可在此更新。
            </p>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label required>学院</Label>
              <Select
                value={college}
                onChange={setCollege}
                placeholder="请选择学院"
                options={COLLEGES.map((item) => ({ value: item, label: item }))}
                ariaLabel="学院"
              />
            </div>
            <div>
              <Label required>年级</Label>
              <Select
                value={grade}
                onChange={setGrade}
                placeholder="请选择年级"
                options={GRADES.map((item) => ({ value: item, label: item }))}
                ariaLabel="年级"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="auth-major" required>
              专业
            </Label>
            <Input
              id="auth-major"
              value={major}
              maxLength={30}
              placeholder="例如：数学与应用数学"
              onChange={(e) => setMajor(e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="auth-class" required>
              班级
            </Label>
            <Input
              id="auth-class"
              value={className}
              maxLength={30}
              list="class-options"
              placeholder="例如：师范1234班"
              onChange={(e) => setClassName(e.target.value)}
            />
            <datalist id="class-options">
              {CLASS_OPTIONS.map((item) => (
                <option key={item} value={item} />
              ))}
            </datalist>
          </div>

          {error ? (
            <p className="rounded-2xl bg-[#FFE9E4] px-4 py-2.5 text-sm text-[#C4473A]">{error}</p>
          ) : null}

          <Button type="submit" disabled={submit.isPending} className="w-full gap-1.5">
            {submit.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <BadgeCheck className="h-4 w-4" />}
            {authed ? "更新认证信息" : "提交认证"}
          </Button>
        </form>
      )}
    </div>
  );
}
