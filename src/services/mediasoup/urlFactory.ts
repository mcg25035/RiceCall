//@ts-ignore
import qs from 'qs';

// 設定 mediasoup 服務器的端口
const protooPort = 4443;

// 使用 HTTPS 協議
const protocol = 'wss';

/**
 * 生成連接到 mediasoup 服務器的 URL
 * @param params 連接參數
 * @returns mediasoup 服務器的 URL
 */
export function getProtooUrl(params: Record<string, any>): string {
  // 從環境變數獲取服務器主機名，如果沒有則使用 localhost
  const hostname = process.env.NEXT_PUBLIC_MEDIASOUP_SERVER || 'localhost';
  
  // 將參數轉換為查詢字符串
  const query = qs.stringify(params);

  // 返回完整的 URL
  return `${protocol}://${hostname}:${protooPort}/?${query}`;
}
