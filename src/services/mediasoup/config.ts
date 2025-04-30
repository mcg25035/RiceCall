/**
 * Mediasoup 配置
 */

// 音頻約束
export const AUDIO_CONSTRAINTS = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true
};

// WebRTC 傳輸約束
export const PC_PROPRIETARY_CONSTRAINTS = {
  // optional: [{ googDscp: true }]
};

// ICE 服務器
export const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' }
];

// 日誌前綴
export const LOG_PREFIX = '[MediasoupService]';
