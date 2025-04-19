/**
 * @name 微博自动发布
 * @description 使用Puppeteer自动登录微博并发布内容、获取动态, 需要使用环境变量：WEIBO_COOKIE
 * @author wangenius
 * @version 1.0.0
 */
import puppeteer, { ElementHandle, Page } from 'puppeteer';
import * as dotenv from 'dotenv';

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

/** 微博信息 */
interface WeiboPost {
  /** 微博ID */
  id: string;
  /** 微博内容 */
  content: string;
  /** 微博HTML内容 */
  htmlContent?: string;
  /** 微博封面图 */
  coverImage?: string;
  /** 所有图片 */
  images?: string[];
  /** 发布时间 */
  publishTime: string;
  /** 点赞数 */
  likes: number;
  /** 转发数 */
  reposts: number;
  /** 评论数 */
  comments: number;
  /** 微博链接 */
  url: string;
  /** 话题标签 */
  topics?: string[];
  /** 作者信息 */
  author?: {
    id: string;
    name: string;
    avatar: string;
    url: string;
  };
  /** 评论列表 */
  commentList?: Array<{
    content: string;
    author: string;
    time: string;
    likes: number;
  }>;
}

/** 获取动态结果 */
interface FetchWeiboResult {
  /** 是否获取成功 */
  success: boolean;
  /** 微博列表 */
  posts?: WeiboPost[];
  /** 错误信息 */
  error?: string;
}

const PUBLISH_URL = "https://weibo.com/";
const HOME_URL = "https://weibo.com/";

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
      // 点击图片上传按钮
      const imageButtonSelector = '.VPlus_file_n7Xjc';
      const imageButton = await waitForSelector(page, imageButtonSelector, 5000);
      
      if (!imageButton) {
        throw new Error('找不到图片上传按钮');
      }
      
      await imageButton.click();
      await delay(1000);
      
      // 查找图片上传输入框
      const uploadInput = await waitForSelector(page, 'input[type="file"]', 5000);
      if (!uploadInput) {
        throw new Error('找不到图片上传输入框');
      }
      
      // 上传图片
      await (uploadInput as ElementHandle<HTMLInputElement>).uploadFile(...options.images);
      
      // 等待图片上传完成
      await page.waitForFunction(() => {
        return document.querySelectorAll('.picture_pic_86nBa').length > 0;
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

/** 提取微博详情内容 */
const extractWeiboDetail = async (page: Page): Promise<{
  content: string;
  htmlContent: string;
  images: string[];
  topics: string[];
  author: {
    id: string;
    name: string;
    avatar: string;
    url: string;
  };
  interactions: {
    likes: number;
    reposts: number;
    comments: number;
  };
  commentList: Array<{
    content: string;
    author: string;
    time: string;
    likes: number;
  }>;
}> => {
  return await page.evaluate(() => {
    // 获取HTML内容
    const weiboContainer = document.querySelector('.Feed_body_3R0rO') || document.querySelector('.WB_detail');
    const htmlContent = weiboContainer ? weiboContainer.outerHTML : '';
    
    // 提取正文内容
    let content = '';
    const contentEl = document.querySelector('.detail_wbtext_4CRf9') || 
                      document.querySelector('.WB_text');
    if (contentEl) {
      content = contentEl.textContent?.trim() || '';
    }
    
    // 提取图片
    const images: string[] = [];
    const imageElements = document.querySelectorAll('.picture_pic_86nBa') || 
                          document.querySelectorAll('.WB_media_wrap img');
    
    imageElements.forEach(img => {
      const src = img.getAttribute('src');
      if (src && !src.includes('avatar') && !src.includes('emoji')) {
        // 获取原图链接
        const originalSrc = src.replace(/\/thumb\d+\//, '/large/').replace(/\/orj\d+\//, '/large/');
        images.push(originalSrc);
      }
    });
    
    // 提取话题标签
    const topics: string[] = [];
    const topicElements = document.querySelectorAll('a[href*="/k/"]') ||
                          document.querySelectorAll('a.a_topic');
    
    topicElements.forEach(topic => {
      if (topic.textContent) {
        // 清理话题文本中的特殊字符
        let topicText = topic.textContent.trim()
          .replace(/^#/, '')
          .replace(/#$/, '')
          .replace(/\s+/g, '');
        
        if (topicText) {
          topics.push(topicText);
        }
      }
    });
    
    // 提取作者信息
    const author = {
      id: '',
      name: '',
      avatar: '',
      url: ''
    };
    
    const authorEl = document.querySelector('.Profile_name_3gQf8') ||
                     document.querySelector('.WB_info a');
    if (authorEl) {
      author.name = authorEl.textContent?.trim() || '';
      
      const authorUrl = authorEl.getAttribute('href') || '';
      author.url = authorUrl.startsWith('http') ? authorUrl : `https://weibo.com${authorUrl}`;
      
      // 从URL中提取用户ID
      const idMatch = author.url.match(/\/u\/([^?/]+)/);
      if (idMatch && idMatch[1]) {
        author.id = idMatch[1];
      }
    }
    
    const avatarEl = document.querySelector('.Profile_avatar_3oBfK img') ||
                     document.querySelector('.WB_face img');
    if (avatarEl) {
      author.avatar = avatarEl.getAttribute('src') || '';
    }
    
    // 提取互动数据
    const interactions = {
      likes: 0,
      reposts: 0,
      comments: 0
    };
    
    // 尝试获取互动数据
    const likeEl = document.querySelector('button[title="赞"] .toolbar_num_JXZul') ||
                   document.querySelector('span[node-type="like_status"] em:last-child');
    if (likeEl && likeEl.textContent) {
      const likeText = likeEl.textContent.trim();
      interactions.likes = parseNumberWithUnit(likeText);
    }
    
    const repostEl = document.querySelector('button[title="转发"] .toolbar_num_JXZul') ||
                     document.querySelector('span[node-type="forward_btn_text"] em:last-child');
    if (repostEl && repostEl.textContent) {
      const repostText = repostEl.textContent.trim();
      interactions.reposts = parseNumberWithUnit(repostText);
    }
    
    const commentEl = document.querySelector('button[title="评论"] .toolbar_num_JXZul') ||
                      document.querySelector('span[node-type="comment_btn_text"] em:last-child');
    if (commentEl && commentEl.textContent) {
      const commentText = commentEl.textContent.trim();
      interactions.comments = parseNumberWithUnit(commentText);
    }
    
    // 提取评论
    const commentList: Array<{
      content: string;
      author: string;
      time: string;
      likes: number;
    }> = [];
    
    const commentItems = document.querySelectorAll('.Comment_content_22-FY') ||
                         document.querySelectorAll('.WB_comment .list_li');
    
    commentItems.forEach(item => {
      let commentContent = '';
      const contentEl = item.querySelector('.Comment_text_20osR') ||
                        item.querySelector('.WB_text');
      if (contentEl && contentEl.textContent) {
        commentContent = contentEl.textContent.trim();
      }
      
      let commentAuthor = '';
      const authorEl = item.querySelector('.Comment_name_24BZa') ||
                       item.querySelector('.WB_text a[usercard]');
      if (authorEl && authorEl.textContent) {
        commentAuthor = authorEl.textContent.trim();
      }
      
      let commentTime = '';
      const timeEl = item.querySelector('.Comment_time_1gesR') ||
                     item.querySelector('.WB_from span');
      if (timeEl && timeEl.textContent) {
        commentTime = timeEl.textContent.trim();
      }
      
      let commentLikes = 0;
      const likesEl = item.querySelector('.Comment_like_3G0g-') ||
                      item.querySelector('.WB_handle span[node-type="like"]');
      if (likesEl && likesEl.textContent) {
        const likesText = likesEl.textContent.trim();
        if (likesText !== '赞') {
          commentLikes = parseNumberWithUnit(likesText);
        }
      }
      
      if (commentContent) {
        commentList.push({
          content: commentContent,
          author: commentAuthor,
          time: commentTime,
          likes: commentLikes
        });
      }
    });
    
    // 辅助函数：解析带单位的数字（如：2.5万）
    function parseNumberWithUnit(text: string): number {
      if (!text || text === '') return 0;
      
      let num = 0;
      if (text.includes('万')) {
        num = parseFloat(text.replace('万', '')) * 10000;
      } else if (text.includes('亿')) {
        num = parseFloat(text.replace('亿', '')) * 100000000;
      } else {
        num = parseInt(text.replace(/,/g, ''), 10) || 0;
      }
      return num;
    }
    
    return {
      content,
      htmlContent,
      images,
      topics,
      author,
      interactions,
      commentList
    };
  });
};

/** 获取微博最新的动态 */
export async function fetchLatestWeibo(limit: number = 10): Promise<FetchWeiboResult> {
  const browser = await puppeteer.launch({
    headless: false,
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  });

  try {
    const page = await browser.newPage();
    
    // 设置默认的 cookie
    const cookie = process.env.WEIBO_COOKIE || '';
    await setupCookies(page, cookie);
    
    // 访问微博首页
    await page.goto(HOME_URL, {
      waitUntil: "networkidle0",
      timeout: 60000
    });
    
    // 等待页面加载完成，确认已登录状态
    await delay(3000);
    
    // 滚动页面以加载更多内容
    await autoScroll(page);
    
    // 获取微博列表
    const weiboCards = await page.evaluate((limitParam) => {
      // 获取所有微博卡片
      const weiboItems = Array.from(document.querySelectorAll('.Feed_item_2xmo1'));
      
      return weiboItems.slice(0, limitParam).map((card) => {
        // 提取微博ID
        const idElement = card.querySelector('.Feed_card_2hGMK[mid]');
        const id = idElement ? idElement.getAttribute('mid') || '' : '';
        
        // 获取微博链接
        const linkElement = card.querySelector('.head_name_24eEB');
        let url = '';
        if (linkElement && linkElement.parentElement) {
          const parentLink = linkElement.parentElement.getAttribute('href');
          if (parentLink) {
            url = parentLink.startsWith('http') ? parentLink : `https://weibo.com${parentLink}`;
          }
        }
        
        // 获取微博内容
        const contentElement = card.querySelector('.detail_wbtext_4CRf9');
        const content = contentElement ? contentElement.textContent?.trim() || '' : '';
        
        // 获取封面图
        let coverImage = '';
        const imgElement = card.querySelector('.picture_pic_86nBa');
        if (imgElement) {
          coverImage = imgElement.getAttribute('src') || '';
        }
        
        // 获取发布时间
        const timeElement = card.querySelector('.head_time_1WJv8');
        const publishTime = timeElement ? timeElement.textContent?.trim() || '' : '';
        
        // 获取作者信息
        const authorElement = card.querySelector('.head_name_24eEB');
        const authorName = authorElement ? authorElement.textContent?.trim() || '' : '';
        
        const authorLinkElement = authorElement ? authorElement.closest('a') : null;
        const authorUrl = authorLinkElement ? authorLinkElement.getAttribute('href') || '' : '';
        const authorId = authorUrl ? authorUrl.split('/').pop()?.split('?')[0] || '' : '';
        
        const authorAvatarElement = card.querySelector('.head_avatar_1pn5W img');
        const authorAvatar = authorAvatarElement ? authorAvatarElement.getAttribute('src') || '' : '';
        
        // 获取互动数据
        let likes = 0;
        const likeElement = card.querySelector('button[title="赞"] .toolbar_num_JXZul');
        if (likeElement && likeElement.textContent) {
          const likeText = likeElement.textContent.trim();
          if (likeText.includes('万')) {
            likes = parseFloat(likeText.replace('万', '')) * 10000;
          } else {
            likes = parseInt(likeText.replace(/,/g, ''), 10) || 0;
          }
        }
        
        let reposts = 0;
        const repostElement = card.querySelector('button[title="转发"] .toolbar_num_JXZul');
        if (repostElement && repostElement.textContent) {
          const repostText = repostElement.textContent.trim();
          if (repostText.includes('万')) {
            reposts = parseFloat(repostText.replace('万', '')) * 10000;
          } else {
            reposts = parseInt(repostText.replace(/,/g, ''), 10) || 0;
          }
        }
        
        let comments = 0;
        const commentElement = card.querySelector('button[title="评论"] .toolbar_num_JXZul');
        if (commentElement && commentElement.textContent) {
          const commentText = commentElement.textContent.trim();
          if (commentText.includes('万')) {
            comments = parseFloat(commentText.replace('万', '')) * 10000;
          } else {
            comments = parseInt(commentText.replace(/,/g, ''), 10) || 0;
          }
        }
        
        // 构建微博对象
        return {
          id,
          content,
          coverImage,
          publishTime,
          likes,
          reposts,
          comments,
          url,
          htmlContent: '',
          images: [],
          topics: [],
          commentList: [],
          author: {
            id: authorId,
            name: authorName,
            avatar: authorAvatar,
            url: authorUrl.startsWith('http') ? authorUrl : `https://weibo.com${authorUrl}`
          }
        } as WeiboPost;
      });
    }, limit);
    
    // 创建完整微博数据列表，包含详细内容
    const completePosts: WeiboPost[] = [];
    
    // 为每个微博获取详细内容
    for (let i = 0; i < weiboCards.length; i++) {
      const card = weiboCards[i] as WeiboPost;
      try {
        // 使用URL打开微博详情页
        const weiboUrl = card.url;
        if (!weiboUrl) {
          // 添加基本信息到结果中
          completePosts.push(card);
          continue;
        }
        
        // 新开标签页访问微博详情
        const newPage = await browser.newPage();
        
        // 设置标签页的视口大小
        await newPage.setViewport({
          width: 1280,
          height: 800
        });
        
        // 尝试直接访问微博URL
        try {
          await newPage.goto(weiboUrl, {
            waitUntil: 'networkidle0',
            timeout: 30000
          });
        } catch (navError) {
          // 导航错误处理
        }
        
        // 等待页面加载
        await delay(5000);
        
        try {
          // 提取微博详情
          const weiboDetail = await extractWeiboDetail(newPage);
          
          // 将详细内容添加到微博数据中
          const post = {...card};
          post.content = weiboDetail.content || post.content;
          post.htmlContent = weiboDetail.htmlContent;
          post.images = weiboDetail.images;
          post.topics = weiboDetail.topics;
          post.likes = weiboDetail.interactions.likes || post.likes;
          post.reposts = weiboDetail.interactions.reposts || post.reposts;
          post.comments = weiboDetail.interactions.comments || post.comments;
          post.author = weiboDetail.author.id ? weiboDetail.author : post.author;
          post.commentList = weiboDetail.commentList;
          
          completePosts.push(post);
        } catch (extractError) {
          completePosts.push(card);
        }
        
        // 关闭详情页
        await newPage.close();
        await delay(1000);
      } catch (error) {
        completePosts.push(card);
      }
    }
    
    return {
      success: true,
      posts: completePosts
    };
    
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
    };
  } finally {
    await browser.close();
  }
}

/** 自动滚动页面以加载更多内容 */
async function autoScroll(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await new Promise<void>((resolve) => {
      let totalHeight = 0;
      const distance = 100;
      const timer = setInterval(() => {
        const scrollHeight = document.body.scrollHeight;
        window.scrollBy(0, distance);
        totalHeight += distance;

        if (totalHeight >= scrollHeight) {
          clearInterval(timer);
          resolve();
        }
      }, 100);
    });
  });
  
  // 额外等待时间，确保内容加载完成
  await delay(2000);
}

interface GetLatestWeiboOptions {
  limit?: number
}

/* 获取微博的最新动态 */
export async function getLatestWeibo(options: GetLatestWeiboOptions) {
  const result = await fetchLatestWeibo(options.limit); 
  let res: string[] = []
  if (result.success && result.posts) {
    result.posts.forEach((post, index) => {
      let item = ""
      item += `\n\n[${index + 1}] ${post.content.substring(0, 50)}${post.content.length > 50 ? '...' : ''}`
      if (post.topics && post.topics.length > 0) {
        item += `\n话题: ${post.topics.join(', ')}`
      }
      if (post.author) {
        item += `\n作者: ${post.author.name}`
      }
      item += `\n发布时间: ${post.publishTime}`
      item += `\n图片数量: ${post.images?.length || 0}`
      item += `\n点赞: ${post.likes}, 转发: ${post.reposts}, 评论: ${post.comments}`
      if (post.commentList && post.commentList.length > 0) {
        item += `\n热门评论(${Math.min(3, post.commentList.length)}条):`
        post.commentList.slice(0, 3).forEach((comment, i) => {
          item += `\n  ${i+1}. ${comment.author}: ${comment.content.substring(0, 30)}${comment.content.length > 30 ? '...' : ''}`
        });
      }
      item += `\n链接: ${post.url}`
      res.push(item)
    });
    return res.join('\n')
  } else {
    console.error('获取微博失败:', result.error);
  }
}
