/**
 * @name 小红书自动发布
 * @description 使用Puppeteer自动登录小红书并发布笔记
 * @author wangenius
 * @version 1.0.0
 */
import puppeteer, { ElementHandle, Page } from 'puppeteer';
import * as dotenv from 'dotenv';

// 加载环境变量
dotenv.config();

/** 小红书发布选项 */
interface XHSPostOptions {
  /** 笔记标题 */
  title: string;
  /** 笔记内容 */
  content: string;
  /** 要上传的图片路径列表（必选） */
  images: string[];
  /** 笔记话题标签 */
  tags?: string[];
  /** 笔记位置信息 */
  location?: string;
}

/** 发布结果 */
interface PostResult {
  /** 是否发布成功 */
  success: boolean;
  /** 发布后的笔记链接 */
  postUrl?: string;
  /** 错误信息 */
  error?: string;
}

/** 小红书笔记信息 */
interface XHSNote {
  /** 笔记ID */
  id: string;
  /** 笔记标题 */
  title: string;
  /** 笔记内容摘要 */
  summary: string;
  /** 笔记详细内容 */
  fullContent?: string;
  /** 笔记HTML内容 */
  htmlContent?: string;
  /** 笔记封面图 */
  coverImage: string;
  /** 所有图片 */
  images?: string[];
  /** 发布时间 */
  publishTime: string;
  /** 点赞数 */
  likes: number;
  /** 收藏数 */
  collects: number;
  /** 评论数 */
  comments: number;
  /** 笔记链接 */
  url: string;
  /** 标签 */
  tags?: string[];
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
interface FetchNotesResult {
  /** 是否获取成功 */
  success: boolean;
  /** 笔记列表 */
  notes?: XHSNote[];
  /** 错误信息 */
  error?: string;
}

const PAGE_URL = "https://creator.xiaohongshu.com/publish/publish?from=menu";
const HOME_URL = "https://www.xiaohongshu.com/";

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

/** 设置小红书cookie */
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
      domain: '.xiaohongshu.com',
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

/** 自动发布小红书笔记 */
export async function postXiaohongshu(options: XHSPostOptions): Promise<PostResult> {
  const browser = await puppeteer.launch({
    headless: false,
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  });

  try {
    const page = await browser.newPage();
    
    // 设置默认的 cookie
    const cookie = process.env.XHS_COOKIE || '';
    await setupCookies(page, cookie);
    
    await page.goto(PAGE_URL, {
      waitUntil: "networkidle0",
      timeout: 1000000
    });
      
    // 寻找上传图文按钮，使用标准选择器和文本内容检查
    const toPublishBtn = await page.evaluateHandle(() => {
      const spans = Array.from(document.querySelectorAll('span'));
      return spans.find(span => span.textContent?.includes('上传图文'));
    }) as ElementHandle<HTMLElement>;

    if (toPublishBtn) {
      await toPublishBtn.click();
    } else {
      throw new Error('找不到发布笔记按钮');
    }

    // 等待页面加载完成
    const uploadInput = await waitForSelector(page, 'input[type="file"]', 10000);
    if (!uploadInput) {
      throw new Error('找不到图片上传输入框');
    }

    await delay(3000);

    // 上传图片
    if (options.images && options.images.length > 0) {
      await (uploadInput as ElementHandle<HTMLInputElement>).uploadFile(...options.images);
    } else {
      throw new Error('没有提供图片');
    }

    // 等待图片上传完成
    await page.waitForFunction(() => {
      const imgs = document.querySelectorAll('img[src^="http"]');
      return imgs.length >= 1;
    }, { timeout: 30000 });

    // 输入标题
    const titleInput = await waitForSelector(page, 'input[placeholder*="标题"]', 10000);
    if (titleInput) {
      await titleInput.click();
      await delay(500);
      await page.keyboard.type(options.title);
    }
    
    // 输入正文内容
    const contentInput = await waitForSelector(page, 'div[contenteditable="true"]', 10000);
    if (contentInput) {
      await contentInput.click();
      await delay(500);
      await page.keyboard.type(options.content);
    }
    await delay(2000);

    // 如果有标签，添加标签
    if (options.tags && options.tags.length > 0) {
      const tagBtn = await waitForSelector(page, 'button:has-text("添加话题")');
      if (tagBtn) {
        await tagBtn.click();
        await delay(1000);
        
        for (const tag of options.tags) {
          const tagInput = await waitForSelector(page, 'input[placeholder*="搜索话题"]');
          if (tagInput) {
            await tagInput.click();
            await delay(500);
            await page.keyboard.type(tag);
            await delay(1500);
            
            const tagItem = await waitForSelector(page, '.topic-item');
            if (tagItem) {
              await tagItem.click();
              await delay(1000);
            }
          }
        }
        
        // 关闭话题选择框
        const closeBtn = await waitForSelector(page, 'button[aria-label="关闭"]');
        if (closeBtn) {
          await closeBtn.click();
          await delay(1000);
        }
      }
    }

    // 如果有位置信息，添加位置
    if (options.location) {
      const locationBtn = await waitForSelector(page, 'button:has-text("添加位置")');
      if (locationBtn) {
        await locationBtn.click();
        await delay(1000);
        
        const locationInput = await waitForSelector(page, 'input[placeholder*="搜索地点"]');
        if (locationInput) {
          await locationInput.click();
          await delay(500);
          await page.keyboard.type(options.location);
          await delay(1500);
          
          const locationItem = await waitForSelector(page, '.location-item');
          if (locationItem) {
            await locationItem.click();
            await delay(1000);
          }
        }
      }
    }
    

    // 点击发布按钮
    const submitBtn = await waitForSelector(page, 'button.publishBtn');
    if (submitBtn) {
      await submitBtn.click();
      await delay(4000);
    } else {
      throw new Error('找不到发布按钮');
    }

    return {
      success: true,
    };

  } catch (error: any) {
    console.error('发布小红书笔记失败:', error);
    return {
      success: false,
      error: error.message,
    };
  } finally {
    await browser.close();
  }
}

/** 提取详情页内容 */
const extractNoteDetail = async (page: Page): Promise<{
  title: string;
  content: string;
  htmlContent: string;
  images: string[];
  tags: string[];
  author: {
    id: string;
    name: string;
    avatar: string;
    url: string;
  };
  interactions: {
    likes: number;
    collects: number;
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
    const noteContainer = document.querySelector('#noteContainer') || document.querySelector('.note-container');
    const htmlContent = noteContainer ? noteContainer.outerHTML : '';
    
    // 提取标题
    let title = '';
    const titleEl = document.querySelector('#detail-title') || 
                   document.querySelector('.title') || 
                   document.querySelector('h1');
    if (titleEl && titleEl.textContent) {
      title = titleEl.textContent.trim();
    }
    
    // 提取正文内容
    let content = '';
    const contentEl = document.querySelector('#detail-desc') || 
                      document.querySelector('.desc') || 
                      document.querySelector('.content') || 
                      document.querySelector('.note-content');
    if (contentEl) {
      // 获取纯文本内容
      content = contentEl.textContent?.trim() || '';
    }
    
    // 提取图片
    const images: string[] = [];
    const imageElements = document.querySelectorAll('img.note-slider-img') || 
                          document.querySelectorAll('.media-container img') ||
                          document.querySelectorAll('.img-container img');
    
    imageElements.forEach(img => {
      const src = img.getAttribute('src');
      if (src && !src.includes('avatar') && !src.includes('emoji')) {
        images.push(src);
      }
    });
    
    // 提取标签
    const tags: string[] = [];
    const tagElements = document.querySelectorAll('.tag') || 
                        document.querySelectorAll('a[id="hash-tag"]');
    
    tagElements.forEach(tag => {
      if (tag.textContent && !tag.textContent.includes('作者')) {
        // 清理标签文本中的特殊字符
        let tagText = tag.textContent.trim()
          .replace(/^#/, '') // 移除开头的#
          .replace(/\s+/g, ''); // 移除空白字符
        
        if (tagText) {
          tags.push(tagText);
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
    
    const authorEl = document.querySelector('.author-wrapper .name') || 
                     document.querySelector('.author-wrapper .username');
    if (authorEl) {
      author.name = authorEl.textContent?.trim() || '';
      
      const authorLink = authorEl.closest('a');
      if (authorLink) {
        author.url = authorLink.getAttribute('href') || '';
        // 从URL中提取用户ID
        const idMatch = author.url.match(/profile\/([^?]+)/);
        if (idMatch && idMatch[1]) {
          author.id = idMatch[1];
        }
      }
    }
    
    const avatarEl = document.querySelector('.author-wrapper img') || 
                     document.querySelector('.avatar-item');
    if (avatarEl) {
      author.avatar = avatarEl.getAttribute('src') || '';
    }
    
    // 提取互动数据
    const interactions = {
      likes: 0,
      collects: 0,
      comments: 0
    };
    
    // 尝试从底部互动栏获取
    const interactionBar = document.querySelector('.engage-bar-style') || 
                          document.querySelector('.buttons');
    
    if (interactionBar) {
      const likesEl = interactionBar.querySelector('.like-wrapper .count');
      if (likesEl && likesEl.textContent) {
        const likesText = likesEl.textContent.trim().replace(/,/g, '');
        if (/^\d+$/.test(likesText)) {
          interactions.likes = parseInt(likesText, 10);
        }
      }
      
      const collectsEl = interactionBar.querySelector('.collect-wrapper .count');
      if (collectsEl && collectsEl.textContent) {
        const collectsText = collectsEl.textContent.trim().replace(/,/g, '');
        if (/^\d+$/.test(collectsText)) {
          interactions.collects = parseInt(collectsText, 10);
        }
      }
      
      const commentsEl = interactionBar.querySelector('.chat-wrapper .count');
      if (commentsEl && commentsEl.textContent) {
        const commentsText = commentsEl.textContent.trim().replace(/,/g, '');
        if (/^\d+$/.test(commentsText)) {
          interactions.comments = parseInt(commentsText, 10);
        }
      }
    }
    
    // 提取评论
    const commentList: Array<{
      content: string;
      author: string;
      time: string;
      likes: number;
    }> = [];
    
    // 提取评论
    const commentItems = document.querySelectorAll('.comment-item:not(.comment-item-sub)');
    commentItems.forEach(item => {
      let commentContent = '';
      const contentEl = item.querySelector('.content');
      if (contentEl && contentEl.textContent) {
        commentContent = contentEl.textContent.trim();
      }
      
      let commentAuthor = '';
      const authorEl = item.querySelector('.author .name');
      if (authorEl && authorEl.textContent) {
        commentAuthor = authorEl.textContent.trim();
      }
      
      let commentTime = '';
      const timeEl = item.querySelector('.date span:first-child');
      if (timeEl && timeEl.textContent) {
        commentTime = timeEl.textContent.trim();
      }
      
      let commentLikes = 0;
      const likesEl = item.querySelector('.like .count');
      if (likesEl && likesEl.textContent) {
        const likesText = likesEl.textContent.trim();
        if (likesText !== '赞' && /^\d+$/.test(likesText)) {
          commentLikes = parseInt(likesText, 10);
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
    
    return {
      title,
      content,
      htmlContent,
      images,
      tags,
      author,
      interactions,
      commentList
    };
  });
};

/** 获取小红书最新的十条动态 */
export async function fetchLatestNotes(limit: number = 10): Promise<FetchNotesResult> {
  const browser = await puppeteer.launch({
    headless: false,
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  });

  try {
    const page = await browser.newPage();
    
    // 设置默认的 cookie
    const cookie = process.env.XHS_COOKIE || '';
    await setupCookies(page, cookie);
    
    // 访问小红书首页
    await page.goto(HOME_URL, {
      waitUntil: "networkidle0",
      timeout: 60000
    });
    
    // 等待页面加载完成，确认已登录状态
    await delay(2000); // 增加等待时间，确保页面完全加载
    
    // 滚动页面以加载更多内容
    await autoScroll(page);
    
    // 获取推荐页面的笔记列表，使用准确的选择器
    const noteCards = await page.evaluate((limitParam) => {
      // 使用确切的卡片选择器
      const noteItems = Array.from(document.querySelectorAll('section.note-item'));
      
      return noteItems.slice(0, limitParam).map((card, index) => {
        // 获取链接 - 使用第二个包含图片的a元素，通常是带有class="cover"的链接
        const linkElement = card.querySelector('a.cover') || 
                            card.querySelectorAll('a')[1]; // 尝试获取第二个a元素作为备选
        const href = linkElement ? linkElement.getAttribute('href') : '';
        const url = href ? (href.startsWith('http') ? href : `https://www.xiaohongshu.com${href}`) : '';
        
        // 提取ID
        const id = url ? url.split('/').pop()?.split('?')[0] || '' : '';
        
        // 获取标题
        const titleElement = card.querySelector('.title span');
        const title = titleElement ? titleElement.textContent?.trim() || '' : '';
        
        // 获取封面图 - 从cover链接中获取
        const imgElement = linkElement ? linkElement.querySelector('img') : null;
        const coverImage = imgElement ? imgElement.getAttribute('src') || '' : '';
        
        // 获取作者信息
        const authorElement = card.querySelector('.author-wrapper .name');
        const authorName = authorElement ? authorElement.textContent?.trim() || '' : '';
        
        const authorLinkElement = card.querySelector('.author-wrapper a.author');
        const authorUrl = authorLinkElement ? authorLinkElement.getAttribute('href') || '' : '';
        const authorId = authorUrl ? authorUrl.split('/').pop()?.split('?')[0] || '' : '';
        
        const authorAvatarElement = card.querySelector('.author-wrapper .author-avatar');
        const authorAvatar = authorAvatarElement ? authorAvatarElement.getAttribute('src') || '' : '';
        
        // 获取点赞数
        const likeCountElement = card.querySelector('.like-wrapper .count');
        const likeCountText = likeCountElement ? likeCountElement.textContent?.trim() || '0' : '0';
        
        // 处理数字带单位的情况（如：2.5万）
        let likes = 0;
        if (likeCountText) {
          if (likeCountText.includes('万')) {
            likes = parseFloat(likeCountText.replace('万', '')) * 10000;
          } else if (likeCountText !== '赞') {
            likes = parseInt(likeCountText.replace(/,/g, ''), 10) || 0;
          }
        }
        
        // 构建笔记对象 - 确保与XHSNote接口兼容
        return {
          id,
          title,
          summary: title, // 暂时用标题作为摘要
          coverImage,
          publishTime: '', // feed流中没有显示发布时间
          likes,
          collects: 0, // feed流中没有显示收藏数
          comments: 0, // feed流中没有显示评论数
          url,
          fullContent: '', // 初始化为空，后续会填充
          htmlContent: '', // 初始化为空，后续会填充
          images: [], // 初始化为空数组，后续会填充
          tags: [], // 初始化为空数组，后续会填充
          commentList: [], // 初始化为空数组，后续会填充
          author: {
            id: authorId,
            name: authorName,
            avatar: authorAvatar,
            url: authorUrl.startsWith('http') ? authorUrl : `https://www.xiaohongshu.com${authorUrl}`
          }
        } as XHSNote;
      });
    }, limit);
    
    // 创建完整笔记数据列表，包含详细内容
    const completeNotes: XHSNote[] = [];
    
    // 为每个笔记获取详细内容
    for (let i = 0; i < noteCards.length; i++) {
      const card = noteCards[i] as XHSNote; // 显式类型转换      
      try {
        // 使用URL打开笔记详情页
        const noteUrl = card.url;
        if (!noteUrl) {
          // 添加基本信息到结果中
          completeNotes.push(card);
          continue;
        }
        
        // 新开标签页访问笔记详情
        const newPage = await browser.newPage();
        
        // 设置标签页的视口大小
        await newPage.setViewport({
          width: 1280,
          height: 800
        });
        
        // 尝试直接访问笔记URL
        try {
          await newPage.goto(noteUrl, {
            waitUntil: 'networkidle0',
            timeout: 30000
          });
        } catch (navError) {
        }
        
        // 等待页面加载
        await delay(5000);
        
        try {
          // 提取笔记详情
          const noteDetail = await extractNoteDetail(newPage);
          
          // 将详细内容添加到笔记数据中
          const note = {...card};
          note.title = noteDetail.title || note.title;
          note.fullContent = noteDetail.content;
          note.htmlContent = noteDetail.htmlContent;
          note.images = noteDetail.images;
          note.tags = noteDetail.tags;
          note.likes = noteDetail.interactions.likes || note.likes;
          note.collects = noteDetail.interactions.collects || note.collects;
          note.comments = noteDetail.interactions.comments || note.comments;
          note.author = noteDetail.author.id ? noteDetail.author : note.author;
          note.commentList = noteDetail.commentList;
          
          completeNotes.push(note);
        } catch (extractError) {
          completeNotes.push(card);
        }
        
        // 关闭详情页
        await newPage.close();
        await delay(1000);
      } catch (error) {
        completeNotes.push(card);
      }
    }    
    return {
      success: true,
      notes: completeNotes
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

interface GetLatestNotesOptions {
  limit?: number
}

/* 获取小红书的最新动态 */
export async function getLatestNotes(options: GetLatestNotesOptions)  {
    const result = await fetchLatestNotes(options.limit); 
    let res: string[] = []
    if (result.success && result.notes) {
      result.notes.forEach((note, index) => {
        let item = ""
        item += `\n\n[${index + 1}] ${note.title || '无标题'}`
        item += `\n摘要: ${note.summary?.substring(0, 50)}${note.summary?.length > 50 ? '...' : ''}`
        if (note.fullContent) {
          item += `\n详细内容: ${note.fullContent.substring(0, 100)}${note.fullContent.length > 100 ? '...' : ''}`
        }
        if (note.tags && note.tags.length > 0) {
          item += `\n标签: ${note.tags.join(', ')}`
        }
        if (note.author) {
          item += `\n作者: ${note.author.name}`
        }
        item += `\n图片数量: ${note.images?.length || 0}`
        item += `\n点赞: ${note.likes}, 收藏: ${note.collects}, 评论: ${note.comments}`
        if (note.commentList && note.commentList.length > 0) {
          item += `\n热门评论(${Math.min(3, note.commentList.length)}条):`
          note.commentList.slice(0, 3).forEach((comment, i) => {
            item += `\n  ${i+1}. ${comment.author}: ${comment.content.substring(0, 30)}${comment.content.length > 30 ? '...' : ''}`
          });
        }
        item += `\n链接: ${note.url}`
        res.push(item)
      });
      return res.join('\n')
    } else {
      console.error('获取动态失败:', result.error);
    }
  }