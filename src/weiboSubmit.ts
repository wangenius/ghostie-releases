/**
 * @name 微博自动发布
 * @description 使用Puppeteer自动登录微博并发布内容、获取动态, 需要使用环境变量：WEIBO_COOKIE
 * @author wangenius
 * @version 1.0.0
 */
import * as dotenv from 'dotenv';
import puppeteer, { ElementHandle, Page } from 'puppeteer';

// 加载环境变量
dotenv.config();

/** 微博发布选项 */
interface WeiboPostOptions {
  /** 微博内容 */
  content: string;
  /** 要上传的图片路径列表（可选） */
  images?: string[];
  /** 微博话题标签 */
  topics?: string[];
  /** 微博位置信息 */
  location?: string;
}

/** 发布结果 */
interface PostResult {
  /** 是否发布成功 */
  success: boolean;
  /** 发布后的微博链接 */
  postUrl?: string;
  /** 错误信息 */
  error?: string;
}



const PUBLISH_URL = "https://weibo.com/";

/** 将 cookie 字符串转换为对象 */
function parseCookieString(cookieString: string): Record<string, string> {
  return cookieString
    .split(';')
    .map(pair => pair.trim())
    .reduce((acc, pair) => {
      const [key, value] = pair.split('=');
      acc[key] = value;
      return acc;
    }, {} as Record<string, string>);
}

/** 设置微博cookie */
async function setupCookies(page: Page, cookieString: string) {
  const cookies = parseCookieString(cookieString);
  const currentCookies = await page.browser().cookies();
  // 先清除现有cookie
  await page.browser().deleteCookie(...currentCookies);
  
  // 设置新的cookie
  for (const [name, value] of Object.entries(cookies)) {
    await page.browser().setCookie({
      name,
      value,
      domain: '.weibo.com',
      path: '/',
    });
  }
}

/** 延迟函数 */
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/** 等待元素出现并返回 */
async function waitForSelector(page: Page, selector: string, timeout = 5000): Promise<ElementHandle<Element> | null> {
  try {
    await page.waitForSelector(selector, { timeout });
    return await page.$(selector);
  } catch (error) {
    console.error(`等待元素 ${selector} 超时`);
    return null;
  }
}

/** 自动发布微博 */
export async function postWeibo(options: WeiboPostOptions): Promise<PostResult> {
  const browser = await puppeteer.launch({
    headless: false,
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  });

  try {
    const page = await browser.newPage();
    
    // 设置默认的 cookie
    const cookie = process.env.WEIBO_COOKIE || '';
    await setupCookies(page, cookie);
    
    await page.goto(PUBLISH_URL, {
      waitUntil: "networkidle0",
      timeout: 60000
    });
    
    // 等待页面加载完成，确认已登录状态
    await delay(1000);
    
    // 点击发布框（微博输入区域）
    const publishBoxSelector = '.Form_input_2gtXx';
    const publishBox = await waitForSelector(page, publishBoxSelector, 10000);
    
    if (!publishBox) {
      throw new Error('找不到微博发布框');
    }
    
    await publishBox.click();
    await delay(1000);
    
    // 输入微博内容
    await page.keyboard.type(options.content);
    await delay(1000);
    
    // 如果有图片，上传图片
    if (options.images && options.images.length > 0) {
      // 查找图片上传输入框
      const uploadInput = await waitForSelector(page, 'input[type="file"]', 5000);
      if (!uploadInput) {
        throw new Error('找不到图片上传输入框');
      }
      
      // 上传图片
      await (uploadInput as ElementHandle<HTMLInputElement>).uploadFile(...options.images);
      
      // 等待图片上传完成
      await page.waitForFunction(() => {
        return document.querySelectorAll('.woo-picture-img').length > 0;
      }, { timeout: 30000 });
      
      await delay(3000);
    }
    
    // 点击发布按钮
    const submitButtonSelector = '.Tool_btn_2Eane';
    const submitButton = await waitForSelector(page, submitButtonSelector, 5000);
    
    if (!submitButton) {
      throw new Error('找不到发布按钮');
    }
    
    await submitButton.click();
    
    // 等待发布完成
    await delay(5000);

    return {
      success: true,
    };
    
  } catch (error: any) {
    console.error('发布微博失败:', error);
    return {
      success: false,
      error: error.message,
    };
  } finally {
    await browser.close();
  }
}
