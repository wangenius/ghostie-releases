/**
* @name 暂停执行
* @description 暂停指定时间的执行
*/

interface SleepParams {
    /* 暂停时间：毫秒ms */
  ms: number;
}

// 暂停200ms
export const sleep = async ({ms}: SleepParams): Promise<string> => {
  await new Promise<void>((resolve) => {
    setTimeout(() => {
      resolve();
    }, ms);
  });
  return "";
}; 