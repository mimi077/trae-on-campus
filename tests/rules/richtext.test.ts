import { describe, expect, it } from "vitest";
import { isRichTextEmpty, isSafeHttpUrl, sanitizeRichText, toPlainText } from "@/lib/rules/richtext";

describe("sanitizeRichText", () => {
  it("保留基础排版标签", () => {
    const html = sanitizeRichText("<p>你好 <strong>世界</strong><br><em>斜体</em></p>");
    expect(html).toBe("<p>你好 <strong>世界</strong><br><em>斜体</em></p>");
  });

  it("移除 script / iframe / style 等危险容器及内容", () => {
    expect(sanitizeRichText('<p>安全</p><script>alert("xss")</script>')).toBe("<p>安全</p>");
    expect(sanitizeRichText('<iframe src="https://evil.example"></iframe><p>ok</p>')).toBe("<p>ok</p>");
    expect(sanitizeRichText("<style>body{display:none}</style><p>ok</p>")).toBe("<p>ok</p>");
    expect(sanitizeRichText('<svg onload="alert(1)"></svg>文本')).toBe("文本");
  });

  it("移除事件属性与内联样式", () => {
    expect(sanitizeRichText('<p onclick="alert(1)" style="color:red">文本</p>')).toBe("<p>文本</p>");
    expect(sanitizeRichText('<img src="x" onerror="alert(1)">')).toBe("");
    expect(sanitizeRichText('<p onmouseover="x">a</p>')).toBe("<p>a</p>");
  });

  it("阻断 javascript / data / vbscript 协议链接", () => {
    const result = sanitizeRichText('<a href="javascript:alert(1)">点我</a>');
    expect(result).not.toContain("javascript:");
    expect(result).toContain("点我");

    const dataResult = sanitizeRichText('<a href="data:text/html;base64,xxx">下载</a>');
    expect(dataResult).not.toContain("data:text/html");
  });

  it("保留安全的 http(s) 链接并强制 noopener", () => {
    const html = sanitizeRichText('<a href="https://example.com/a?b=1" onclick="x">官网</a>');
    expect(html).toBe(
      '<a href="https://example.com/a?b=1" target="_blank" rel="noopener noreferrer nofollow">官网</a>',
    );
  });

  it("移除不在白名单中的标签但保留文字", () => {
    expect(sanitizeRichText("<section><marquee>滚动</marquee>文字</section>")).toBe("滚动文字");
  });

  it("移除 HTML 注释", () => {
    expect(sanitizeRichText("<!-- 注释 --><p>正文</p>")).toBe("<p>正文</p>");
  });

  it("空值与超长内容安全处理", () => {
    expect(sanitizeRichText(null)).toBe("");
    expect(sanitizeRichText("")).toBe("");
    expect(sanitizeRichText("<p>0123456789</p>", 8)).toBe("<p>01234");
  });
});

describe("toPlainText", () => {
  it("提取纯文本并解码常用实体", () => {
    expect(toPlainText("<p>Hello&nbsp;<strong>World</strong></p>")).toBe("Hello World");
    expect(toPlainText("<p>a &amp; b &lt; c</p>")).toBe("a & b < c");
  });

  it("块级标签转换为空格并合并空白", () => {
    expect(toPlainText("<div>第一段</div><div>第二段</div>")).toBe("第一段 第二段");
    expect(toPlainText("  <li> 项目 </li>  ")).toBe("项目");
  });

  it("按最大长度截断并补充省略号", () => {
    expect(toPlainText("<p>abcdef</p>", 3)).toBe("abc…");
    expect(toPlainText("<p>abc</p>", 10)).toBe("abc");
  });

  it("空值返回空字符串", () => {
    expect(toPlainText(null)).toBe("");
    expect(toPlainText("")).toBe("");
  });
});

describe("isRichTextEmpty", () => {
  it("仅标签没有文字视为空", () => {
    expect(isRichTextEmpty("<p><br></p>")).toBe(true);
    expect(isRichTextEmpty("<p>内容</p>")).toBe(false);
    expect(isRichTextEmpty(null)).toBe(true);
  });
});

describe("isSafeHttpUrl", () => {
  it("只接受 http(s) 绝对地址", () => {
    expect(isSafeHttpUrl("https://example.com")).toBe(true);
    expect(isSafeHttpUrl("http://example.com/a?b=1")).toBe(true);
    expect(isSafeHttpUrl("javascript:alert(1)")).toBe(false);
    expect(isSafeHttpUrl("/relative/path")).toBe(false);
    expect(isSafeHttpUrl("")).toBe(false);
    expect(isSafeHttpUrl(null)).toBe(false);
  });
});
