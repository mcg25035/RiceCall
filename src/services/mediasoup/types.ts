/**
 * Mediasoup 相關類型定義
 */

// 房間選項
export interface RoomOptions {
  // 房間 ID
  roomId: string;
  // 對等 ID
  peerId: string;
  // 顯示名稱
  displayName: string;
  // 設備信息
  device: any;
  // 是否強制使用 TCP
  forceTcp?: boolean;
  // 是否產生媒體
  produce?: boolean;
  // 是否消費媒體
  consume?: boolean;
  // 是否使用數據通道
  useDataChannel?: boolean;
}

// 對等體信息
export interface PeerInfo {
  // 對等體 ID
  id: string;
  // 顯示名稱
  displayName: string;
  // 設備信息
  device: {
    // 設備標誌
    flag: string;
    // 設備名稱
    name: string;
    // 設備版本
    version: string;
  };
}

// 房間事件
export enum RoomEvent {
  // 連接中
  CONNECTING = 'connecting',
  // 已連接
  CONNECTED = 'connected',
  // 連接失敗
  CONNECTION_FAILED = 'connectionFailed',
  // 已斷開連接
  DISCONNECTED = 'disconnected',
  // 已關閉
  CLOSED = 'closed',
  // 錯誤
  ERROR = 'error',
  // 新對等體
  NEW_PEER = 'newPeer',
  // 對等體關閉
  PEER_CLOSED = 'peerClosed',
  // 麥克風已啟用
  MIC_ENABLED = 'micEnabled',
  // 麥克風已禁用
  MIC_DISABLED = 'micDisabled',
  // 麥克風已靜音
  MIC_MUTED = 'micMuted',
  // 麥克風已取消靜音
  MIC_UNMUTED = 'micUnmuted',
  // 新消費者
  NEW_CONSUMER = 'newConsumer',
  // 消費者關閉
  CONSUMER_CLOSED = 'consumerClosed',
  // 音量變化
  VOLUME_CHANGE = 'volumeChange',
  // 新音頻消費者
  NEW_AUDIO_CONSUMER = 'newAudioConsumer',
  // 對等體生產者暫停（從伺服器通知）
  PEER_PRODUCER_PAUSED = 'peerProducerPaused',
  // 對等體生產者恢復（從伺服器通知）
  PEER_PRODUCER_RESUMED = 'peerProducerResumed',
}
