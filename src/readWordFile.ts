import { promises as fs } from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import os from 'os';

const execAsync = promisify(exec);

/**
 * @name 读取Word文档内容
 * @description 读取指定路径的Word文档内容并转换为文本
 * @tips 需要安装pandoc
 */

// 参数定义
interface ReadWordParams {
  // Word文档绝对路径
  wordPath: string;
  // 是否保存提取的文本到文件（可选）
  saveToFile?: boolean;
  // 输出文本文件名（可选，仅当saveToFile为true时有效）
  outputFileName?: string;
  // 是否保留数学公式（可选，默认为false）
  preserveMath?: boolean;
}

// 辅助函数：获取文件扩展名
function getExtension(filePath: string): string {
  return path.extname(filePath);
}

// 辅助函数：获取文件名(不含扩展名)
function getBaseName(filePath: string, ext?: string): string {
  const filename = path.basename(filePath);
  if (ext && filename.endsWith(ext)) {
    return filename.slice(0, -ext.length);
  }
  const extension = getExtension(filename);
  return extension ? filename.slice(0, -(extension.length + 1)) : filename;
}

// 辅助函数：获取目录路径
function getDirName(filePath: string): string {
  return path.dirname(filePath);
}

// 辅助函数：连接路径
function joinPath(...parts: string[]): string {
  return path.join(...parts);
}

// 读取Word文档内容函数
export async function readWordContent(params: ReadWordParams): Promise<string> {
  let tempTextFile: string | null = null;
  let tempHtmlFile: string | null = null;

  try {
    // 确保输入文件存在
    try {
      await fs.access(params.wordPath);
    } catch {
      throw new Error(`Word文档不存在: ${params.wordPath}`);
    }

    // 创建临时文件
    tempTextFile = path.join(os.tmpdir(), `temp-${Date.now()}.txt`);
    tempHtmlFile = path.join(os.tmpdir(), `temp-${Date.now()}.html`);

    if (params.preserveMath) {
      // 首先转换为HTML以保留数学公式
      const { stderr: htmlStderr } = await execAsync(
        `pandoc "${params.wordPath}" -o "${tempHtmlFile}" --from docx --to html --mathml`
      );

      if (htmlStderr && !htmlStderr.includes('[WARNING]')) {
        throw new Error(`Pandoc HTML转换失败: ${htmlStderr}`);
      }

      // 然后将HTML转换为文本，但保留数学公式
      const { stderr: textStderr } = await execAsync(
        `pandoc "${tempHtmlFile}" -o "${tempTextFile}" --from html --to plain --wrap=none`
      );

      if (textStderr && !textStderr.includes('[WARNING]')) {
        throw new Error(`Pandoc 文本转换失败: ${textStderr}`);
      }
    } else {
      // 直接转换为纯文本，忽略数学公式
      const { stderr } = await execAsync(
        `pandoc "${params.wordPath}" -o "${tempTextFile}" --from docx --to plain --wrap=none`
      );

      if (stderr && !stderr.includes('[WARNING]')) {
        throw new Error(`Pandoc 转换失败: ${stderr}`);
      }
    }

    // 读取转换后的文本内容
    const textContent = await fs.readFile(tempTextFile, 'utf-8');

    // 如果需要保存提取的文本到文件
    if (params.saveToFile) {
      const docDir = getDirName(params.wordPath);
      const baseFileName =
        params.outputFileName || getBaseName(params.wordPath, ".docx");
      const outputFilePath = joinPath(docDir, `${baseFileName}.txt`);
      await fs.writeFile(outputFilePath, textContent, 'utf-8');
    }

    return textContent;
  } catch (error) {
    throw error;
  } finally {
    // 清理临时文件
    for (const file of [tempTextFile, tempHtmlFile]) {
      if (file) {
        try {
          await fs.unlink(file);
        } catch (error) {
          console.error('清理临时文件失败:', error);
        }
      }
    }
  }
}