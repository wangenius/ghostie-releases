/**
 * @name 桌面文件列表
 * @description 获取用户桌面所有文件和文件夹的列表
 * @author wangenius
 * @version 1.0.0
 */

import fs from "fs";
import path from "path";
import os from "os";

/** 文件列表选项 */
interface DesktopFilesOptions {
  /** 是否包含隐藏文件 */
  includeHidden?: boolean;
  /** 是否递归获取子文件夹 */
  recursive?: boolean;
  /** 文件过滤器 */
  filter?: (fileName: string) => boolean;
}

/** 文件数据 */
interface FileData {
  /** 文件名 */
  name: string;
  /** 文件路径 */
  path: string;
  /** 文件类型 */
  type: "file" | "directory";
  /** 文件大小（字节） */
  size: number;
  /** 创建时间 */
  createdAt: Date;
  /** 修改时间 */
  modifiedAt: Date;
  /** 子文件（仅当type为directory且recursive为true时） */
  children?: FileData[];
}

/** 获取桌面文件列表 */
export async function getDesktopFiles(options: DesktopFilesOptions): Promise<FileData[]> {
  try {
    // 默认参数
    const { 
      includeHidden = false, 
      recursive = false,
      filter = () => true 
    } = options;

    // 获取桌面路径
    const desktopPath = path.join(os.homedir(), "Desktop");
    
    // 读取文件
    return readDirectoryContents(desktopPath, includeHidden, recursive, filter);
  } catch (error) {
    console.error("获取桌面文件列表失败:", error);
    throw error;
  }
}

/**
 * 读取目录内容
 */
function readDirectoryContents(
  dirPath: string,
  includeHidden: boolean,
  recursive: boolean,
  filter: (fileName: string) => boolean
): FileData[] {
  const files = fs.readdirSync(dirPath);
  const result: FileData[] = [];

  for (const file of files) {
    // 跳过隐藏文件（以.开头）
    if (!includeHidden && file.startsWith(".")) {
      continue;
    }

    // 应用过滤器
    if (!filter(file)) {
      continue;
    }

    const filePath = path.join(dirPath, file);
    const stats = fs.statSync(filePath);
    const isDirectory = stats.isDirectory();

    const fileData: FileData = {
      name: file,
      path: filePath,
      type: isDirectory ? "directory" : "file",
      size: stats.size,
      createdAt: stats.birthtime,
      modifiedAt: stats.mtime,
    };

    // 如果是目录且需要递归读取
    if (isDirectory && recursive) {
      fileData.children = readDirectoryContents(
        filePath,
        includeHidden,
        recursive,
        filter
      );
    }

    result.push(fileData);
  }

  return result;
}

/** 格式化文件大小 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${units[i]}`;
} 