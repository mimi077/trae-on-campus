"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo } from "react";
import { ArrowLeft, Download, ExternalLink, Film, Images, Sparkles } from "lucide-react";
import { BackLink } from "@/components/back-link";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { formatDateTime } from "@/lib/utils";
import { sanitizeRichText } from "@/lib/rules/richtext";
import { api } from "@/trpc/react";

export default function WorkDetailPage() {
  const params = useParams<{ id: string; workId: string }>();
  const activityId = typeof params?.id === "string" ? params.id : "";
  const workId = typeof params?.workId === "string" ? params.workId : "";
  const workQuery = api.showcase.byId.useQuery({ id: workId }, { enabled: Boolean(workId) });

  const safeHtml = useMemo(() => sanitizeRichText(workQuery.data?.description), [workQuery.data?.description]);
  const work = workQuery.data;

  if (workQuery.isLoading) {
    return (
      <div className="space-y-4">
        <BackLink href={`/activities/${activityId}/works`} label="返回作品展示" />
        <div className="h-80 animate-pulse rounded-3xl bg-white/50" />
      </div>
    );
  }

  if (workQuery.isError || !work) {
    return (
      <div className="space-y-4">
        <BackLink href={`/activities/${activityId}/works`} label="返回作品展示" />
        <EmptyState
          icon={<Images className="h-5 w-5" />}
          title="作品不存在或尚未通过审核"
          description={workQuery.error?.message ?? "该作品可能已被删除。"}
          action={
            <Link href={`/activities/${activityId}/works`} className={buttonClass({ variant: "outline", size: "sm" })}>
              返回作品列表
            </Link>
          }
        />
      </div>
    );
  }

  const images = work.media.filter((item) => item.type === "IMAGE");
  const videos = work.media.filter((item) => item.type === "VIDEO");
  const files = work.media.filter((item) => item.type === "FILE");

  return (
    <div className="space-y-5">
      <BackLink href={`/activities/${activityId}/works`} label="返回作品展示" />

      <article className="overflow-hidden rounded-3xl bg-white/65 backdrop-blur-sm">
        <div className="relative aspect-[16/9] w-full overflow-hidden bg-primary-soft/40">
          {work.coverUrl ? (
            <img
              src={work.coverUrl}
              alt={work.title}
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="grid h-full place-items-center text-sm text-muted-foreground">暂无封面</div>
          )}
          <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
            {work.pinned ? (
              <span className="rounded-full bg-primary px-2.5 py-1 text-[11px] font-medium text-primary-foreground">置顶</span>
            ) : null}
            {work.featured ? (
              <span className="rounded-full bg-accent px-2.5 py-1 text-[11px] font-medium text-peach-foreground">精选</span>
            ) : null}
            <span className="rounded-full bg-white/85 px-2.5 py-1 text-[11px] text-foreground">{work.categoryName}</span>
          </div>
        </div>

        <div className="space-y-4 p-5 sm:p-6">
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold leading-8 text-foreground">{work.title}</h1>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                {work.authorName}
              </span>
              <span>更新于 {formatDateTime(work.updatedAt)}</span>
              {work.status !== "APPROVED" ? <Badge variant="outline">当前状态：{work.status}</Badge> : null}
            </div>
            {work.workUrl ? (
              <a
                href={work.workUrl}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className={buttonClass({ variant: "default", size: "sm", className: "gap-1.5" })}
              >
                <ExternalLink className="h-3.5 w-3.5" />
                访问作品
              </a>
            ) : null}
          </div>

          <div
            className="space-y-3 text-sm leading-7 text-foreground [&_a]:text-primary [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:border-primary/30 [&_blockquote]:pl-3 [&_h1]:text-lg [&_h1]:font-semibold [&_h2]:text-base [&_h2]:font-semibold [&_h3]:font-semibold [&_li]:ml-5 [&_li]:list-disc [&_ol_li]:list-decimal [&_p]:leading-7 [&_ul]:space-y-1"
            dangerouslySetInnerHTML={{ __html: safeHtml || "<p>作者暂未填写作品描述。</p>" }}
          />

          {images.length > 0 ? (
            <section className="space-y-2">
              <h2 className="text-sm font-semibold text-foreground">作品图片</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {images.map((item) => (
                  <figure key={item.url} className="overflow-hidden rounded-2xl bg-primary-soft/30">
                    <img
                      src={item.url}
                      alt={item.name ?? work.title}
                      loading="lazy"
                      decoding="async"
                      className="h-56 w-full object-cover"
                    />
                    {item.name ? <figcaption className="px-3 py-2 text-[11px] text-muted-foreground">{item.name}</figcaption> : null}
                  </figure>
                ))}
              </div>
            </section>
          ) : null}

          {videos.length > 0 ? (
            <section className="space-y-2">
              <h2 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                <Film className="h-4 w-4 text-primary" />
                作品视频
              </h2>
              <div className="space-y-3">
                {videos.map((item) => (
                  <div key={item.url} className="overflow-hidden rounded-2xl bg-black/85">
                    <video controls preload="metadata" className="w-full" src={item.url}>
                      你的浏览器暂不支持视频播放，可直接打开链接查看。
                    </video>
                    <div className="flex items-center justify-between px-3 py-2 text-[11px] text-white/80">
                      <span className="truncate">{item.name ?? "作品演示视频"}</span>
                      <a href={item.url} target="_blank" rel="noopener noreferrer nofollow" className="underline">
                        新窗口打开
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {files.length > 0 ? (
            <section className="space-y-2">
              <h2 className="text-sm font-semibold text-foreground">附件下载</h2>
              <div className="space-y-2">
                {files.map((item) => (
                  <a
                    key={item.url}
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="flex items-center gap-2 rounded-2xl bg-white/70 px-4 py-3 text-sm text-foreground transition hover:bg-primary-soft/60"
                  >
                    <Download className="h-4 w-4 text-primary" />
                    <span className="truncate">{item.name ?? item.url}</span>
                  </a>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      </article>

      <div className="flex items-center justify-between">
        <Link href={`/activities/${activityId}/works`} className={buttonClass({ variant: "ghost", size: "sm", className: "gap-1" })}>
          <ArrowLeft className="h-3.5 w-3.5" />
          返回作品列表
        </Link>
        <Link href={`/activities/${activityId}`} className={buttonClass({ variant: "outline", size: "sm" })}>
          查看活动详情
        </Link>
      </div>
    </div>
  );
}
