/**
 * @name Markdown 转 PDF 插件
 * @description 将指定的 Markdown 文件转换为 PDF 文件。该插件依赖 pandoc 以及 xelatex，需要提前安装：https://pandoc.org/installing.html、https://miktex.org/download
 */

import { execFile } from "child_process";
import { promisify } from "util";
import * as fs from "fs/promises";
import * as path from "path";

const execFileAsync = promisify(execFile);

interface MarkdownToPDFParams {
  // Markdown 文件绝对路径
  markdownPath: string;
  // 文件名（可选）
  name?: string;
}

//导出markdown文件为PDF时使用
export async function markdownToPDF(params: MarkdownToPDFParams) {
  let outputPath: string;
  try {
    // 获取 Markdown 文件目录
    const markdownDir = path.dirname(params.markdownPath);
    const fileName = params.name || path.basename(params.markdownPath, ".md");
    outputPath = path.join(markdownDir, `${fileName}.pdf`);

    // 检查文件是否存在
    try {
      await fs.stat(params.markdownPath);
    } catch {
      throw new Error(`输入文件不存在: ${params.markdownPath}`);
    }

    // 调用 pandoc 进行转换
    await execFileAsync("pandoc", [
      params.markdownPath,
      "-o",
      outputPath,
      "-f",
      "markdown",
      "-t",
      "pdf",
      "--pdf-engine",
      "xelatex",
    ]);

    return outputPath;
  } catch (error: any) {
    console.error("转换 Markdown 到 PDF 时发生错误:", error);
    throw new Error(`转换失败: ${error.message}`);
  }
}

markdownToPDF({
  markdownPath: "c:/Users/wange/Desktop/高三数学试卷.md",
  name: "高三数学试卷",
});

