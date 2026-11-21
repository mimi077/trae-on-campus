import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  AI_DISCLAIMER,
  AI_SYSTEM_PROMPT,
  AI_TIMEOUT_MS,
  isSupportedImageDataUrl,
  parseAiSuggestion,
} from "@/lib/rules/ai";
import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";

const AI_MODEL = process.env.AI_MODEL?.trim() || "gpt-4o-mini";
const AI_BASE_URL = (process.env.AI_BASE_URL?.trim() || "https://api.openai.com/v1").replace(/\/+$/, "");

type ChatCompletionResponse = {
  choices?: { message?: { content?: string } }[];
};

function userPrompt(title?: string, category?: string) {
  const context = [title ? `用户填写的标题：${title}` : null, category ? `用户选择的分类：${category}` : null]
    .filter(Boolean)
    .join("；");
  return context ? `请分析这张二手物品图片。${context}` : "请分析这张二手物品图片。";
}

/**
 * 闲置发布 AI 增强：只做临时分析，不落库、不修改 item.create。
 * 未配置 API Key 时直接抛 PRECONDITION_FAILED，前端提示「请手动填写」并保留全部表单数据。
 */
export const aiRouter = createTRPCRouter({
  status: publicProcedure.query(() => ({
    enabled: Boolean(process.env.AI_API_KEY?.trim()),
    model: AI_MODEL,
  })),

  analyzeItemImage: publicProcedure
    .input(
      z.object({
        imageBase64: z.string().min(32, "请先上传物品图片").max(6_000_000, "图片过大，请压缩后重试"),
        title: z.string().trim().max(60).optional(),
        category: z.string().trim().max(20).optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const apiKey = process.env.AI_API_KEY?.trim();
      if (!apiKey) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "AI 解析暂时不可用，请手动填写商品信息",
        });
      }
      if (!isSupportedImageDataUrl(input.imageBase64)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "请上传 PNG / JPG / WebP 图片，且大小不超过 4MB",
        });
      }

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);

      try {
        const response = await fetch(`${AI_BASE_URL}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          signal: controller.signal,
          body: JSON.stringify({
            model: AI_MODEL,
            temperature: 0.2,
            max_tokens: 500,
            messages: [
              { role: "system", content: AI_SYSTEM_PROMPT },
              {
                role: "user",
                content: [
                  { type: "text", text: userPrompt(input.title, input.category) },
                  { type: "image_url", image_url: { url: input.imageBase64 } },
                ],
              },
            ],
          }),
        });

        if (!response.ok) {
          throw new TRPCError({
            code: "BAD_GATEWAY",
            message: "AI 解析暂时不可用，请手动填写商品信息",
          });
        }

        const payload = (await response.json()) as ChatCompletionResponse;
        const content = payload.choices?.[0]?.message?.content;
        const suggestion = typeof content === "string" ? parseAiSuggestion(content) : null;
        if (!suggestion) {
          throw new TRPCError({
            code: "BAD_GATEWAY",
            message: "AI 解析暂时不可用，请手动填写商品信息",
          });
        }

        return { ...suggestion, disclaimer: AI_DISCLAIMER };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "BAD_GATEWAY",
          message: controller.signal.aborted
            ? "AI 解析超时，请稍后重试或手动填写商品信息"
            : "AI 解析暂时不可用，请手动填写商品信息",
        });
      } finally {
        clearTimeout(timer);
      }
    }),
});
