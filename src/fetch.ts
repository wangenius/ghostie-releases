/**
 * @name 雨果网新闻获取
 * @description 使用fetch获取雨果网新闻数据
 * @author wangenius
 * @version 1.0.0
 */

interface NewsItem {
  title: string;
  description: string;
  url: string;
}

interface NewsResponse {
  count: number;
  data: Array<{
    display: {
      title: string;
      description: string;
      url: string;
    };
  }>;
}

/**
 * 获取雨果网新闻数据
 */
export async function fetchNews(): Promise<NewsItem[]> {
  try {
    const response = await fetch(
      "https://www.cifnews.com/index/ajax/newsfeed/3?page=1&size=20&tempIndex=0&token=",
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data: NewsResponse = await response.json();

    // 提取所需字段
    return data.data.map((item) => ({
      title: item.display.title,
      description: item.display.description,
      url: item.display.url,
    }));
  } catch (error) {
    console.error("获取新闻数据失败:", error);
    throw error;
  }
}

// 使用示例
async function main() {
  try {
    const news = await fetchNews();
    console.log(JSON.stringify(news, null, 2));
  } catch (error) {
    console.error("运行失败:", error);
  }
}
