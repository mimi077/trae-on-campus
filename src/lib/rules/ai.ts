/**
 * 闲置发布 AI 增强规则（纯函数）
 * 仅用于校验模型输出与图片入参，不涉及数据库；模型不可用时不影响原有手动发布流程。
 */

export const AI_IMAGE_MAX_BYTES = 4 * 1024 * 1024;
export const AI_TIMEOUT_MS = 25_000;
export const AI_DISCLAIMER = "AI 生成内容仅作为参考，请人工核对物品描述与价格，确认无误后发布";

/** PRD 规定的固定系统提示词，需在交付文档中完整留存 */
export const AI_SYSTEM_PROMPT = `你是校园二手闲置物品分析助手。
根据用户上传的二手物品图片，完成两件事：
1. suggestDesc：生成一段适合大学校园二手平台的商品简介，简洁真实，描述物品外观、用途，适合学生交易。
2. priceMin、priceMax：输出该二手物品在大学校园场景合理的人民币价格区间，仅作为参考。

严格只返回JSON，格式：
{"suggestDesc":"","priceMin":数字,"priceMax":数字}
禁止输出JSON以外任何解释文字，不要加markdown标记。`;

export type AiSuggestion = {
  suggestDesc: string;
  priceMin: number;
  priceMax: number;
};

/** data URL 的近似字节数，用于拦截过大的图片请求 */
export function estimateDataUrlBytes(dataUrl: string): number {
  const commaIndex = dataUrl.indexOf(",");
  if (commaIndex < 0) return 0;
  const base64 = dataUrl.slice(commaIndex + 1).replace(/\s/g, "");
  if (!base64) return 0;
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((base64.length * 3) / 4) - padding);
}

export function isSupportedImageDataUrl(value: string): boolean {
  if (!/^data:image\/(png|jpe?g|webp);base64,/i.test(value)) return false;
  const bytes = estimateDataUrlBytes(value);
  return bytes > 0 && bytes <= AI_IMAGE_MAX_BYTES;
}

function readPrice(value: unknown): number | null {
  const numeric =
    typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : Number.NaN;
  if (!Number.isFinite(numeric) || numeric < 0 || numeric > 1_000_000) return null;
  return Math.round(numeric * 100) / 100;
}

/**
 * 严格解析模型返回文本：允许包裹代码块或少量说明文字，但必须能取到合法 JSON。
 * 结构不合法一律返回 null，由调用方走降级提示，避免前端解析崩溃。
 */
export function parseAiSuggestion(raw: string): AiSuggestion | null {
  if (typeof raw !== "string" || !raw.trim()) return null;

  let candidate = raw.trim();
  if (candidate.startsWith("```")) {
    candidate = candidate.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  }
  if (!candidate.startsWith("{")) {
    const matched = candidate.match(/\{[\s\S]*\}/);
    if (!matched) return null;
    candidate = matched[0];
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(candidate);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;

  const record = parsed as Record<string, unknown>;
  const descCandidate = [record.suggestDesc, record.description, record.desc].find(
    (value): value is string => typeof value === "string" && value.trim().length > 0,
  );
  if (!descCandidate) return null;

  const priceMin = readPrice(record.priceMin ?? record.minPrice);
  const priceMax = readPrice(record.priceMax ?? record.maxPrice);
  if (priceMin === null || priceMax === null) return null;

  return {
    suggestDesc: descCandidate.trim().slice(0, 300),
    priceMin: Math.min(priceMin, priceMax),
    priceMax: Math.max(priceMin, priceMax),
  };
}

export function formatPriceRange(priceMin: number, priceMax: number): string {
  return `${priceMin}-${priceMax}元`;
}
