import { describe, expect, it } from "vitest";
import {
  AI_IMAGE_MAX_BYTES,
  estimateDataUrlBytes,
  formatPriceRange,
  isSupportedImageDataUrl,
  parseAiSuggestion,
} from "@/lib/rules/ai";

describe("estimateDataUrlBytes", () => {
  it("按 base64 长度估算字节数", () => {
    expect(estimateDataUrlBytes("data:image/png;base64,AAAA")).toBe(3);
    expect(estimateDataUrlBytes("data:image/png;base64,AAA=")).toBe(2);
    expect(estimateDataUrlBytes("data:image/png;base64,AA==")).toBe(1);
    expect(estimateDataUrlBytes("not-a-data-url")).toBe(0);
    expect(estimateDataUrlBytes("data:image/png;base64,")).toBe(0);
  });
});

describe("isSupportedImageDataUrl", () => {
  it("仅接受 PNG / JPG / WebP 且不超过 4MB", () => {
    expect(isSupportedImageDataUrl("data:image/png;base64,AAAA")).toBe(true);
    expect(isSupportedImageDataUrl("data:image/jpeg;base64,AAAA")).toBe(true);
    expect(isSupportedImageDataUrl("data:image/jpg;base64,AAAA")).toBe(true);
    expect(isSupportedImageDataUrl("data:image/webp;base64,AAAA")).toBe(true);
    expect(isSupportedImageDataUrl("data:image/gif;base64,AAAA")).toBe(false);
    expect(isSupportedImageDataUrl("https://example.com/a.png")).toBe(false);
    expect(isSupportedImageDataUrl("data:image/png;base64,")).toBe(false);
  });

  it("超过大小上限时拒绝", () => {
    const base64Length = Math.ceil((AI_IMAGE_MAX_BYTES * 4) / 3) + 8;
    const tooLarge = `data:image/png;base64,${"A".repeat(base64Length)}`;
    expect(isSupportedImageDataUrl(tooLarge)).toBe(false);
  });
});

describe("parseAiSuggestion", () => {
  it("解析裸 JSON", () => {
    expect(parseAiSuggestion('{"suggestDesc":"九成新教材","priceMin":15,"priceMax":25}')).toEqual({
      suggestDesc: "九成新教材",
      priceMin: 15,
      priceMax: 25,
    });
  });

  it("兼容代码块与附带说明文字", () => {
    const fenced = '```json\n{"suggestDesc":"键盘手感良好","priceMin":80,"priceMax":120}\n```';
    expect(parseAiSuggestion(fenced)).toMatchObject({ priceMin: 80, priceMax: 120 });

    const wrapped = '分析结果如下：{"suggestDesc":"自行车","priceMin":100,"priceMax":200} 谢谢';
    expect(parseAiSuggestion(wrapped)?.suggestDesc).toBe("自行车");
  });

  it("兼容字符串价格、别名与区间倒置", () => {
    expect(parseAiSuggestion('{"description":"台灯","minPrice":"19.9","maxPrice":"9.9"}')).toEqual({
      suggestDesc: "台灯",
      priceMin: 9.9,
      priceMax: 19.9,
    });
    expect(parseAiSuggestion('{"desc":"耳机","priceMin":30,"priceMax":30}')).toMatchObject({
      priceMin: 30,
      priceMax: 30,
    });
  });

  it("描述过长时截断到 300 字", () => {
    const long = "好".repeat(400);
    const result = parseAiSuggestion(`{"suggestDesc":"${long}","priceMin":1,"priceMax":2}`);
    expect(result?.suggestDesc).toHaveLength(300);
  });

  it("结构非法时返回 null", () => {
    expect(parseAiSuggestion("")).toBeNull();
    expect(parseAiSuggestion("抱歉，我无法识别这张图片")).toBeNull();
    expect(parseAiSuggestion("{invalid json}")).toBeNull();
    expect(parseAiSuggestion("[1,2,3]")).toBeNull();
    expect(parseAiSuggestion('{"priceMin":1,"priceMax":2}')).toBeNull();
    expect(parseAiSuggestion('{"suggestDesc":"物品","priceMin":-1,"priceMax":2}')).toBeNull();
    expect(parseAiSuggestion('{"suggestDesc":"物品","priceMin":"abc","priceMax":2}')).toBeNull();
    expect(parseAiSuggestion('{"suggestDesc":"物品","priceMin":1,"priceMax":20000000}')).toBeNull();
  });
});

describe("formatPriceRange", () => {
  it("输出参考价格区间", () => {
    expect(formatPriceRange(10, 20)).toBe("10-20元");
  });
});
