/**
 * @name 网页爬虫
 * @description 使用Puppeteer爬取网页内容并转换为Markdown格式
 * @author wangenius
 * @version 1.0.0
 */

import puppeteer from "puppeteer";

/** 爬虫选项 */
interface CrawlerOptions {
  /** 要爬取的网页URL */
  url: string;
}

/** 页面数据 */
interface PageData {
  /** 网页URL */
  url: string;
  /** 网页内容 */
  content: string;
}

/** HTML到Markdown的转换函数 */
function htmlToMarkdown(html: string): string {
  // 移除HTML标签，保留文本内容
  let content = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
    .replace(/<[^>]+>/g, (match) => {
      // 处理标题标签
      if (match.match(/^<h[1-6]/i)) {
        const level = match.charAt(2);
        return `\n${"#".repeat(parseInt(level))} `;
      }
      // 处理段落标签
      if (match === "<p>" || match === "<div>") return "\n\n";
      if (match === "</p>" || match === "</div>") return "\n";
      // 处理列表标签
      if (match === "<li>") return "\n- ";
      if (match === "<ul>" || match === "<ol>") return "\n";
      // 处理代码块
      if (match === "<pre>") return "\n```\n";
      if (match === "</pre>") return "\n```\n";
      if (match === "<code>") return " ";
      if (match === "</code>") return " ";
      // 处理其他标签
      return "";
    })
    // 清理多余的空行
    .replace(/\n\s*\n/g, "\n\n")
    // 清理行首空白
    .replace(/^\s+/gm, "")
    // 移除空行
    .replace(/^\n+|\n+$/g, "")
    // 处理特殊字符
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

  return content;
}

/** 爬取网页内容 */
export async function crawl(params: CrawlerOptions): Promise<PageData> {
  try {
    const { url } = params;
    const browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
      executablePath:
        "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    });

    const page = await browser.newPage();

    try {
      await page.goto(url, { waitUntil: "networkidle0" });

      // 获取页面HTML内容
      const html = await page.content();

      // 提取主要内容区域
      const content = await page.evaluate(() => {
        // 移除不需要的元素
        const selectorsToRemove = [
          "script",
          "style",
          "nav",
          "footer",
          "header",
          "iframe",
          "noscript",
        ];

        selectorsToRemove.forEach((selector) => {
          document.querySelectorAll(selector).forEach((el) => el.remove());
        });

        // 获取主要内容
        const mainContent = document.body.innerHTML;
        return mainContent;
      });

      // 将HTML转换为Markdown
      const markdown = htmlToMarkdown(content);

      return {
        url,
        content: markdown || "",
      };
    } finally {
      await page.close();
      await browser.close();
    }
  } catch (error) {
    console.error("爬虫运行失败:", error);
    throw error;
  }
}