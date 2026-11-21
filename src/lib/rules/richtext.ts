/**
 * 富文本白名单净化（纯字符串实现，Node / 浏览器均可运行）。
 * 作品描述允许基础排版，但必须阻断脚本、事件属性、危险协议与内嵌框架，
 * 从数据入口处消除存储型 XSS。
 */

const ALLOWED_TAGS = new Set([
  "p",
  "br",
  "hr",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "s",
  "del",
  "ul",
  "ol",
  "li",
  "blockquote",
  "h1",
  "h2",
  "h3",
  "h4",
  "a",
  "code",
  "pre",
  "span",
  "div",
]);

const DANGEROUS_BLOCKS =
  /<\s*(script|style|iframe|object|embed|svg|math|template|noscript|link|meta|base|form)\b[\s\S]*?<\s*\/\s*\1\s*>/gi;
const DANGEROUS_SINGLE =
  /<\s*(script|style|iframe|object|embed|svg|math|template|noscript|link|meta|base|form)\b[^>]*\/?>/gi;
const EVENT_ATTR = /\s+on[a-zA-Z0-9_-]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/g;
const RISKY_ATTR = /\s+(style|srcset|formaction|xlink:href)\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi;
const DANGEROUS_PROTOCOL =
  /\b(href|src)\s*=\s*(?:"\s*(?:javascript|data|vbscript):[^"]*"|'\s*(?:javascript|data|vbscript):[^']*'|(?:javascript|data|vbscript):[^\s>]*)/gi;
const TAG_PATTERN = /<\s*\/?\s*([a-zA-Z][a-zA-Z0-9]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/g;

function escapeAttr(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function isSafeHttpUrl(value: string | null | undefined): boolean {
  if (!value) return false;
  return /^https?:\/\/[^\s]+$/i.test(value.trim());
}

function extractHref(attrs: string): string | null {
  const match = /href\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(attrs);
  const raw = (match?.[1] ?? match?.[2] ?? match?.[3] ?? "").trim();
  if (!raw || !isSafeHttpUrl(raw)) return null;
  return raw;
}

export function sanitizeRichText(input: string | null | undefined, maxLength = 5000): string {
  if (typeof input !== "string" || !input) return "";

  let html = input.slice(0, Math.max(0, maxLength));

  html = html.replace(DANGEROUS_BLOCKS, "");
  html = html.replace(DANGEROUS_SINGLE, "");
  html = html.replace(/<!--[\s\S]*?-->/g, "");
  html = html.replace(EVENT_ATTR, "");
  html = html.replace(RISKY_ATTR, "");
  html = html.replace(DANGEROUS_PROTOCOL, '$1="#"');

  html = html.replace(
    TAG_PATTERN,
    (full: string, rawName: string, attrs: string) => {
      const name = rawName.toLowerCase();
      if (!ALLOWED_TAGS.has(name)) return "";
      const closing = /^<\s*\//.test(full);
      if (closing) return name === "a" ? "</a>" : `</${name}>`;
      if (name === "a") {
        const href = extractHref(attrs);
        if (!href) return "";
        return `<a href="${escapeAttr(href)}" target="_blank" rel="noopener noreferrer nofollow">`;
      }
      return `<${name}>`;
    },
  );

  return html.trim();
}

const ENTITY_MAP: Record<string, string> = {
  "&nbsp;": " ",
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
};

/** 富文本转纯文本：用于列表摘要、提交回执与搜索索引 */
export function toPlainText(input: string | null | undefined, maxLength?: number): string {
  if (!input) return "";
  let text = input
    .replace(/<\s*(br|hr)\s*\/?>/gi, " ")
    .replace(/<\s*\/\s*(p|div|li|h[1-4]|blockquote|pre)\s*>/gi, " ")
    .replace(/<[^>]*>/g, " ");

  text = text.replace(/&[a-zA-Z#0-9]+;/g, (entity) => ENTITY_MAP[entity.toLowerCase()] ?? " ");
  text = text.replace(/\s+/g, " ").trim();

  if (typeof maxLength === "number" && text.length > maxLength) {
    return `${text.slice(0, Math.max(0, maxLength))}…`;
  }
  return text;
}

export function isRichTextEmpty(input: string | null | undefined): boolean {
  return toPlainText(input).length === 0;
}
