/**
 * @name 桌面文件列表示例
 * @description 展示如何使用桌面文件列表插件
 */

import { getDesktopFiles, formatFileSize } from "./getDesktopFiles";

async function main() {
  try {
    console.log("正在获取桌面文件列表...");
    
    // 获取所有桌面文件（不包含隐藏文件）
    const files = await getDesktopFiles({
      includeHidden: false,
      recursive: false
    });
    
    console.log(`共找到 ${files.length} 个文件/文件夹`);
    
    // 打印文件列表
    console.log("\n文件列表:");
    files.forEach(file => {
      console.log(`${file.name} (${file.type}) - ${formatFileSize(file.size)}`);
    });
    
    // 筛选出所有PDF文件
    const pdfFiles = await getDesktopFiles({
      filter: (fileName) => fileName.toLowerCase().endsWith('.pdf'),
      includeHidden: false,
      recursive: false
    });
    
    console.log(`\n共找到 ${pdfFiles.length} 个PDF文件:`);
    pdfFiles.forEach(file => {
      console.log(`${file.name} - ${formatFileSize(file.size)}`);
    });
    
    // 获取递归的文件夹结构
    const recursiveFiles = await getDesktopFiles({
      recursive: true,
      includeHidden: false
    });
    
    console.log("\n文件夹结构:");
    printFileTree(recursiveFiles);
    
  } catch (error) {
    console.error("发生错误:", error);
  }
}

// 打印文件树结构
function printFileTree(files: any[], indent = 0) {
  files.forEach(file => {
    console.log(`${' '.repeat(indent * 2)}${file.name} (${file.type})`);
    if (file.children && file.children.length > 0) {
      printFileTree(file.children, indent + 1);
    }
  });
}

// 运行示例
main(); 