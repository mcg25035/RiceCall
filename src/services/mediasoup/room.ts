import * as mediasoupClient from 'mediasoup-client';
import protooClient from 'protoo-client';
import {
  AUDIO_CONSTRAINTS,
  LOG_PREFIX,
  PC_PROPRIETARY_CONSTRAINTS,
} from './config';
import { RoomEvent, RoomOptions } from './types';
import { getProtooUrl } from './urlFactory';

/**
 * MediasoupRoom 類，用於管理與 mediasoup 服務器的連接
 */
export class MediasoupRoom {
  // 房間 ID
  private _roomId: string;
  // 對等 ID
  private _peerId: string;
  // 顯示名稱
  private _displayName: string;
  // 設備信息
  private _device: any;
  // 是否強制使用 TCP
  private _forceTcp: boolean = false;
  // 是否產生媒體
  private _produce: boolean = true;
  // 是否消費媒體
  private _consume: boolean = true;
  // 是否使用數據通道
  private _useDataChannel: boolean = true;
  // protoo URL
  private _protooUrl: string;
  // protoo 客戶端
  private _protoo: protooClient.Peer | null = null;
  // mediasoup 設備
  private _mediasoupDevice: mediasoupClient.Device | null = null;
  // 發送傳輸
  private _sendTransport: mediasoupClient.types.Transport | null = null;
  // 接收傳輸
  private _recvTransport: mediasoupClient.types.Transport | null = null;
  // 麥克風生產者
  private _micProducer: mediasoupClient.types.Producer | null = null;
  // 消費者集合
  private _consumers: Map<string, mediasoupClient.types.Consumer> = new Map();
  // 事件回調
  private _eventCallbacks: Record<string, Function[]> = {};
  // 關閉標誌
  private _closed: boolean = false;

  /**
   * 構造函數
   * @param options 選項
   */
  constructor(options: RoomOptions) {
    this._roomId = options.roomId;
    this._peerId = options.peerId;
    this._displayName = options.displayName;
    this._device = options.device;
    this._forceTcp = options.forceTcp || false;
    this._produce = options.produce !== false;
    this._consume = options.consume !== false;
    this._useDataChannel = options.useDataChannel !== false;

    // 生成 protoo URL
    this._protooUrl = getProtooUrl({
      roomId: this._roomId,
      peerId: this._peerId,
    });

    console.log(`${LOG_PREFIX} 創建房間，URL: ${this._protooUrl}`);
  }

  /**
   * 加入房間
   */
  async join(): Promise<void> {
    console.log(`${LOG_PREFIX} 加入房間`);

    try {
      // 創建 WebSocket 傳輸
      const protooTransport = new protooClient.WebSocketTransport(
        this._protooUrl,
      );

      // 創建 protoo 對等體
      this._protoo = new protooClient.Peer(protooTransport);

      // 觸發連接中事件
      this._emitEvent(RoomEvent.CONNECTING);

      // 監聽 protoo 事件
      this._protoo.on('open', () => this._joinRoom());
      this._protoo.on('failed', () => {
        console.error(`${LOG_PREFIX} WebSocket 連接失敗`);
        this._emitEvent(RoomEvent.CONNECTION_FAILED);
      });
      this._protoo.on('disconnected', () => {
        console.error(`${LOG_PREFIX} WebSocket 斷開連接`);
        this._emitEvent(RoomEvent.DISCONNECTED);

        // 如果房間未關閉，嘗試重新連接
        if (!this._closed) {
          console.log(`${LOG_PREFIX} 嘗試重新連接`);
          const newTransport = new protooClient.WebSocketTransport(
            this._protooUrl,
          );
          this._protoo = new protooClient.Peer(newTransport);
        }
      });
      this._protoo.on('close', () => {
        console.log(`${LOG_PREFIX} WebSocket 關閉`);
        this._emitEvent(RoomEvent.CLOSED);

        if (this._closed) return;

        this.close();
      });

      // 監聽通知
      this._protoo.on('notification', (notification: any) => {
        console.log(`${LOG_PREFIX} 收到通知:`, notification);
        this._handleNotification(notification);
      });

      // 監聽請求
      this._protoo.on(
        'request',
        (request: any, accept: Function, reject: Function) => {
          console.log(`${LOG_PREFIX} 收到請求:`, request);
          this._handleRequest(request, accept, reject);
        },
      );
    } catch (error) {
      console.error(`${LOG_PREFIX} 加入房間失敗:`, error);
      this._emitEvent(RoomEvent.ERROR, error);
      throw error;
    }
  }

  /**
   * 關閉房間
   */
  close(): void {
    if (this._closed) {
      console.log(`${LOG_PREFIX} close: 房間已標記為關閉，跳過`);
      return;
    }

    console.log(`${LOG_PREFIX} close: 開始關閉房間 (peerId: ${this._peerId})`);
    this._closed = true;

    // 關閉 protoo 連接
    if (this._protoo) {
      console.log(`${LOG_PREFIX} close: 正在關閉 Protoo 連接...`);
      this._protoo.close();
      this._protoo = null;
      console.log(`${LOG_PREFIX} close: Protoo 連接已關閉`);
    }

    // 關閉麥克風生產者
    if (this._micProducer) {
      console.log(`${LOG_PREFIX} close: 正在關閉麥克風生產者...`);
      this._micProducer.close();
      this._micProducer = null;
      console.log(`${LOG_PREFIX} close: 麥克風生產者已關閉`);
    }

    // 關閉所有消費者
    console.log(
      `${LOG_PREFIX} close: 正在關閉 ${this._consumers.size} 個消費者...`,
    );
    for (const consumer of this._consumers.values()) {
      consumer.close();
    }
    this._consumers.clear();
    console.log(`${LOG_PREFIX} close: 所有消費者已關閉`);

    // 關閉發送傳輸
    if (this._sendTransport) {
      console.log(
        `${LOG_PREFIX} close: 正在關閉 SendTransport (ID: ${this._sendTransport.id})...`,
      );
      this._sendTransport.close();
      this._sendTransport = null;
      console.log(`${LOG_PREFIX} close: SendTransport 已關閉並設為 null`);
    } else {
      console.log(`${LOG_PREFIX} close: SendTransport 本身為 null，無需關閉`);
    }

    // 關閉接收傳輸
    if (this._recvTransport) {
      console.log(
        `${LOG_PREFIX} close: 正在關閉 RecvTransport (ID: ${this._recvTransport.id})...`,
      );
      this._recvTransport.close();
      this._recvTransport = null;
      console.log(`${LOG_PREFIX} close: RecvTransport 已關閉並設為 null`);
    } else {
      console.log(`${LOG_PREFIX} close: RecvTransport 本身為 null，無需關閉`);
    }

    // 觸發關閉事件
    console.log(`${LOG_PREFIX} close: 觸發 CLOSED 事件`);
    this._emitEvent(RoomEvent.CLOSED);
    console.log(`${LOG_PREFIX} close: 房間關閉流程完成`);
  }

  /**
   * 啟用麥克風
   */
  async enableMic(): Promise<void> {
    console.log(`${LOG_PREFIX} enableMic: 開始 (closed=${this._closed})`);
    if (this._closed) {
      console.warn(`${LOG_PREFIX} enableMic: 房間已關閉，中止操作`);
      return;
    }

    if (!this._mediasoupDevice) {
      console.error(`${LOG_PREFIX} enableMic: Mediasoup 設備未初始化`);
      throw new Error('Mediasoup 設備未初始化');
    }
    if (!this._sendTransport) {
      console.error(
        `${LOG_PREFIX} enableMic: SendTransport 為 null (檢查點 2)`,
      );
      throw new Error('SendTransport is null before getUserMedia');
    }
    if (this._closed) {
      console.warn(
        `${LOG_PREFIX} enableMic: 房間在 Transport 檢查後關閉，中止操作`,
      );
      return;
    }

    // 如果已經有麥克風生產者，先關閉它
    if (this._micProducer) {
      console.log(`${LOG_PREFIX} enableMic: 已存在麥克風生產者，先關閉`);
      this._micProducer.close();
      this._micProducer = null;
    }

    try {
      // 獲取麥克風媒體流
      console.log(`${LOG_PREFIX} enableMic: 請求 getUserMedia...`);
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: AUDIO_CONSTRAINTS,
      });
      console.log(`${LOG_PREFIX} enableMic: getUserMedia 成功`);

      if (this._closed) {
        console.warn(
          `${LOG_PREFIX} enableMic: 房間在 getUserMedia 後關閉，中止 produce`,
        );
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      if (!this._sendTransport) {
        console.error(
          `${LOG_PREFIX} enableMic: SendTransport 在 getUserMedia 後變為 null`,
        );
        stream.getTracks().forEach((track) => track.stop());
        throw new Error('SendTransport became null after getUserMedia');
      }

      const track = stream.getAudioTracks()[0];

      // 創建生產者
      console.log(`${LOG_PREFIX} enableMic: 準備調用 sendTransport.produce...`);
      this._micProducer = await this._sendTransport.produce({
        track,
        codecOptions: {
          opusStereo: false,
          opusDtx: true,
          opusFec: true,
          opusNack: true,
        },
      });
      console.log(`${LOG_PREFIX} enableMic: sendTransport.produce 成功`);

      // 監聽生產者事件
      this._micProducer.on('transportclose', () => {
        console.log(`${LOG_PREFIX} enableMic: 麥克風生產者 transportclose`);
        this._micProducer = null;
      });

      this._micProducer.on('trackended', () => {
        console.log(`${LOG_PREFIX} enableMic: 麥克風生產者 trackended`);
        if (!this._closed) {
          this.disableMic();
        }
      });

      // 觸發麥克風啟用事件，並傳遞 stream
      console.log(`${LOG_PREFIX} enableMic: 觸發 MIC_ENABLED 事件`);
      this._emitEvent(RoomEvent.MIC_ENABLED, stream);
    } catch (error) {
      console.error(`${LOG_PREFIX} enableMic 執行失敗:`, error);
      this._emitEvent(RoomEvent.ERROR, error);
    }
    console.log(`${LOG_PREFIX} enableMic: 結束`);
  }

  /**
   * 禁用麥克風
   */
  async disableMic(): Promise<void> {
    console.log(`${LOG_PREFIX} 禁用麥克風`);

    if (!this._micProducer) return;

    try {
      // 關閉麥克風生產者
      this._micProducer.close();

      // 通知服務器關閉生產者
      if (this._protoo && !this._closed) {
        await this._protoo.request('closeProducer', {
          producerId: this._micProducer.id,
        });
      }

      this._micProducer = null;

      // 觸發麥克風禁用事件
      this._emitEvent(RoomEvent.MIC_DISABLED);
    } catch (error) {
      console.error(`${LOG_PREFIX} 禁用麥克風失敗:`, error);
      this._emitEvent(RoomEvent.ERROR, error);
      throw error;
    }
  }

  /**
   * 靜音麥克風
   */
  muteMic(): void {
    console.log(`${LOG_PREFIX} 靜音麥克風`);

    if (!this._micProducer) {
      console.warn(`${LOG_PREFIX} 麥克風生產者不存在，無法靜音`);
      return;
    }

    try {
      console.log(`${LOG_PREFIX} 暫停麥克風生產者`);
      this._micProducer.pause();

      // 通知服務器暫停生產者
      if (this._protoo && !this._closed) {
        console.log(
          `${LOG_PREFIX} 通知服務器暫停生產者: ${this._micProducer.id}`,
        );
        this._protoo
          .request('pauseProducer', {
            producerId: this._micProducer.id,
          })
          .catch((error) => {
            console.error(`${LOG_PREFIX} 通知服務器暫停生產者失敗:`, error);
          });
      }

      // 觸發麥克風靜音事件
      console.log(`${LOG_PREFIX} 觸發麥克風靜音事件`);
      this._emitEvent(RoomEvent.MIC_MUTED);
    } catch (error) {
      console.error(`${LOG_PREFIX} 靜音麥克風失敗:`, error);
    }
  }

  /**
   * 取消靜音麥克風
   */
  unmuteMic(): void {
    console.log(`${LOG_PREFIX} 取消靜音麥克風`);

    if (!this._micProducer) {
      console.warn(`${LOG_PREFIX} 麥克風生產者不存在，無法取消靜音`);
      return;
    }

    try {
      console.log(`${LOG_PREFIX} 恢復麥克風生產者`);
      this._micProducer.resume();

      // 通知服務器恢復生產者
      if (this._protoo && !this._closed) {
        console.log(
          `${LOG_PREFIX} 通知服務器恢復生產者: ${this._micProducer.id}`,
        );
        this._protoo
          .request('resumeProducer', {
            producerId: this._micProducer.id,
          })
          .catch((error) => {
            console.error(`${LOG_PREFIX} 通知服務器恢復生產者失敗:`, error);
          });
      }

      // 觸發麥克風取消靜音事件
      console.log(`${LOG_PREFIX} 觸發麥克風取消靜音事件`);
      this._emitEvent(RoomEvent.MIC_UNMUTED);
    } catch (error) {
      console.error(`${LOG_PREFIX} 取消靜音麥克風失敗:`, error);
    }
  }

  /**
   * 註冊事件監聽器
   * @param event 事件名稱
   * @param callback 回調函數
   */
  on(event: RoomEvent, callback: Function): void {
    if (!this._eventCallbacks[event]) {
      this._eventCallbacks[event] = [];
    }
    this._eventCallbacks[event].push(callback);
  }

  /**
   * 移除事件監聽器
   * @param event 事件名稱
   * @param callback 回調函數
   */
  off(event: RoomEvent, callback: Function): void {
    if (!this._eventCallbacks[event]) return;

    this._eventCallbacks[event] = this._eventCallbacks[event].filter(
      (cb) => cb !== callback,
    );
  }

  /**
   * 觸發事件
   * @param event 事件名稱
   * @param args 事件參數
   */
  private _emitEvent(event: RoomEvent, ...args: any[]): void {
    if (!this._eventCallbacks[event]) return;

    for (const callback of this._eventCallbacks[event]) {
      callback(...args);
    }
  }

  /**
   * 處理通知
   * @param notification 通知
   */
  private _handleNotification(notification: any): void {
    const { method, data } = notification;

    switch (method) {
      case 'producerScore': {
        // 處理生產者評分通知
        const { producerId, score } = data;
        console.log(`${LOG_PREFIX} 生產者評分:`, producerId, score);
        break;
      }
      case 'newPeer': {
        // 處理新對等體通知
        const { id, displayName, device } = data;
        console.log(`${LOG_PREFIX} 新對等體加入:`, id, displayName, device);
        this._emitEvent(RoomEvent.NEW_PEER, { id, displayName, device });
        break;
      }
      case 'peerClosed': {
        // 處理對等體關閉通知
        const { peerId } = data;
        console.log(`${LOG_PREFIX} 對等體關閉:`, peerId);
        this._emitEvent(RoomEvent.PEER_CLOSED, { peerId });
        break;
      }
      case 'producerPaused': {
        const { peerId /*, producerId */ } = data; // 可能只需要 peerId
        console.log(
          `${LOG_PREFIX} 收到 producerPaused 通知 for peer: ${peerId}`,
        );
        this._emitEvent(RoomEvent.PEER_PRODUCER_PAUSED, { peerId });
        break;
      }
      case 'producerResumed': {
        const { peerId /*, producerId */ } = data; // 可能只需要 peerId
        console.log(
          `${LOG_PREFIX} 收到 producerResumed 通知 for peer: ${peerId}`,
        );
        this._emitEvent(RoomEvent.PEER_PRODUCER_RESUMED, { peerId });
        break;
      }
      case 'consumerPaused': {
        const { consumerId } = data;
        console.log(
          `${LOG_PREFIX} 收到 consumerPaused 通知 for consumer: ${consumerId}`,
        );
        // 嘗試從 consumerId 找到 peerId 並觸發對等體狀態更新
        const consumer = this._consumers.get(consumerId);
        if (consumer && consumer.appData.peerId) {
          const peerId = consumer.appData.peerId;
          console.log(
            `  -> Found peerId: ${peerId} from consumer ${consumerId}. Emitting PEER_PRODUCER_PAUSED.`,
          );
          this._emitEvent(RoomEvent.PEER_PRODUCER_PAUSED, { peerId });
        } else {
          console.warn(`  -> Could not find peerId for consumer ${consumerId}`);
        }
        break;
      }
      case 'consumerResumed': {
        const { consumerId } = data;
        console.log(
          `${LOG_PREFIX} 收到 consumerResumed 通知 for consumer: ${consumerId}`,
        );
        // 嘗試從 consumerId 找到 peerId 並觸發對等體狀態更新
        const consumer = this._consumers.get(consumerId);
        if (consumer && consumer.appData.peerId) {
          const peerId = consumer.appData.peerId;
          console.log(
            `  -> Found peerId: ${peerId} from consumer ${consumerId}. Emitting PEER_PRODUCER_RESUMED.`,
          );
          this._emitEvent(RoomEvent.PEER_PRODUCER_RESUMED, { peerId });
        } else {
          console.warn(`  -> Could not find peerId for consumer ${consumerId}`);
        }
        break;
      }
      default: {
        console.log(`${LOG_PREFIX} 未處理的通知:`, method, data);
      }
    }
  }

  /**
   * 處理請求
   * @param request 請求
   * @param accept 接受函數
   * @param reject 拒絕函數
   */
  private _handleRequest(
    request: any,
    accept: Function,
    reject: Function,
  ): void {
    const { method, data } = request;

    switch (method) {
      case 'newConsumer': {
        // 處理新消費者請求
        console.log(`${LOG_PREFIX} 收到新消費者請求:`, data);

        if (!this._consume) {
          console.error(`${LOG_PREFIX} 不想消費，拒絕請求`);
          reject(403, 'I do not want to consume');
          break;
        }

        // 檢查是否可以消費
        if (!this._mediasoupDevice || !this._recvTransport) {
          console.error(`${LOG_PREFIX} 設備或傳輸未準備好，拒絕請求`);
          reject(403, 'cannot consume (device or transport not ready)');
          break;
        }

        console.log(`${LOG_PREFIX} 可以消費，繼續處理請求`);

        const {
          peerId,
          producerId,
          id,
          kind,
          rtpParameters,
          appData,
          producerPaused,
        } = data;

        try {
          // 創建消費者
          this._recvTransport
            .consume({
              id,
              producerId,
              kind,
              rtpParameters,
              appData: { ...appData, peerId },
            })
            .then((consumer) => {
              // 存儲消費者
              this._consumers.set(consumer.id, consumer);

              consumer.on('transportclose', () => {
                this._consumers.delete(consumer.id);
              });

              // 如果是音頻消費者，觸發新音頻消費者事件
              if (kind === 'audio') {
                console.log(
                  `${LOG_PREFIX} 收到音頻消費者，peerId: ${peerId}, producerId: ${producerId}`,
                );
                const { track } = consumer;
                console.log(`${LOG_PREFIX} 音頻軌道:`, track);

                // 創建音頻元素
                const audioElement = new Audio();
                audioElement.srcObject = new MediaStream([track]);
                audioElement.autoplay = true;
                audioElement.volume = 1.0;
                audioElement.muted = false;
                audioElement.controls = true; // 添加控制項，方便調試
                audioElement.id = `audio-${consumer.id}`; // 添加ID，方便查找

                // 移除以下添加 DOM 和設置樣式的程式碼
                /*
                // 設置樣式，使其可見
                audioElement.style.position = 'fixed';
                audioElement.style.bottom = '10px';
                audioElement.style.left = '10px';
                audioElement.style.zIndex = '9999';
                audioElement.style.backgroundColor = '#f0f0f0';
                audioElement.style.padding = '5px';
                audioElement.style.borderRadius = '5px';

                // 嘗試將音頻元素添加到 DOM
                try {
                  document.body.appendChild(audioElement);
                  console.log(
                    `${LOG_PREFIX} 已將音頻元素添加到 DOM: ${audioElement.id}`,
                  );

                  // 嘗試播放音頻 (可能因為瀏覽器策略需要用戶交互)
                  audioElement.play().catch((error) => {
                    console.warn(
                      `${LOG_PREFIX} 自動播放音頻失敗，可能需要用戶交互:`,
                      error,
                    );
                  });
                } catch (error) {
                  console.error(
                    `${LOG_PREFIX} 將音頻元素添加到 DOM 失敗:`,
                    error,
                  );
                }
                */

                // 觸發新音頻消費者事件，將創建的 audioElement 傳遞出去
                console.log(`${LOG_PREFIX} 觸發 NEW_AUDIO_CONSUMER 事件`);
                this._emitEvent(RoomEvent.NEW_AUDIO_CONSUMER, {
                  consumer,
                  audioElement,
                  peerId,
                });
              }

              // 如果生產者暫停，暫停消費者
              if (producerPaused) {
                consumer.pause();
              }
            })
            .catch((err) => {
              console.error(`${LOG_PREFIX} 創建消費者失敗:`, err);
            });

          // 接受請求
          accept();
        } catch (err: any) {
          console.error(`${LOG_PREFIX} 創建消費者失敗:`, err);
          reject(500, err.toString());
        }
        break;
      }
      default: {
        console.log(`${LOG_PREFIX} 未處理的請求:`, method, data);
        reject(404, 'Method not implemented');
      }
    }
  }

  /**
   * 加入房間
   */
  private async _joinRoom(): Promise<void> {
    console.log(`${LOG_PREFIX} _joinRoom: 開始`);

    try {
      // 創建 mediasoup 設備
      this._mediasoupDevice = new mediasoupClient.Device();
      console.log(`${LOG_PREFIX} _joinRoom: Mediasoup 設備已創建`);

      // 獲取路由器 RTP 能力
      const routerRtpCapabilities = await this._protoo!.request(
        'getRouterRtpCapabilities',
      );
      console.log(`${LOG_PREFIX} _joinRoom: 路由器 RTP 能力已獲取`);

      // 加載設備
      await this._mediasoupDevice.load({ routerRtpCapabilities });
      console.log(`${LOG_PREFIX} _joinRoom: Mediasoup 設備已加載`);

      // 創建發送傳輸
      console.log(
        `${LOG_PREFIX} _joinRoom: 檢查是否需要創建 SendTransport (produce=${this._produce})`,
      );
      if (this._produce) {
        console.log(`${LOG_PREFIX} _joinRoom: 調用 _createSendTransport...`);
        await this._createSendTransport();
        console.log(`${LOG_PREFIX} _joinRoom: _createSendTransport 調用完畢`);
      } else {
        console.log(`${LOG_PREFIX} _joinRoom: 不需要創建 SendTransport`);
      }

      // 創建接收傳輸
      console.log(
        `${LOG_PREFIX} _joinRoom: 檢查是否需要創建 RecvTransport (consume=${this._consume})`,
      );
      if (this._consume) {
        console.log(`${LOG_PREFIX} _joinRoom: 調用 _createRecvTransport...`);
        await this._createRecvTransport();
        console.log(`${LOG_PREFIX} _joinRoom: _createRecvTransport 調用完畢`);
      } else {
        console.log(`${LOG_PREFIX} _joinRoom: 不需要創建 RecvTransport`);
      }

      // 加入房間
      console.log(`${LOG_PREFIX} _joinRoom: 發送 join 請求...`);
      const { peers } = await this._protoo!.request('join', {
        displayName: this._displayName,
        device: this._device,
        rtpCapabilities: this._consume
          ? this._mediasoupDevice.rtpCapabilities
          : undefined,
        sctpCapabilities:
          this._useDataChannel && this._consume
            ? this._mediasoupDevice.sctpCapabilities
            : undefined,
      });
      console.log(`${LOG_PREFIX} _joinRoom: join 請求成功, peers:`, peers);

      // 觸發連接事件
      this._emitEvent(RoomEvent.CONNECTED);

      // 觸發對等體事件
      for (const peer of peers) {
        this._emitEvent(RoomEvent.NEW_PEER, peer);
      }

      // 啟用麥克風
      console.log(`${LOG_PREFIX} _joinRoom: 準備調用 enableMic`);
      console.log(
        `${LOG_PREFIX} _joinRoom: 當前 _sendTransport:`,
        this._sendTransport,
      );
      await this.enableMic();
      console.log(`${LOG_PREFIX} _joinRoom: enableMic 調用完畢`);
    } catch (error) {
      console.error(`${LOG_PREFIX} _joinRoom 執行失敗:`, error);
      this._emitEvent(RoomEvent.ERROR, error);
      this.close();
    }
  }

  /**
   * 創建發送傳輸
   */
  private async _createSendTransport(): Promise<void> {
    console.log(`${LOG_PREFIX} _createSendTransport: 開始`);

    try {
      // 請求創建 WebRTC 傳輸
      console.log(
        `${LOG_PREFIX} _createSendTransport: 請求 createWebRtcTransport...`,
      );
      const transportInfo = await this._protoo!.request(
        'createWebRtcTransport',
        {
          forceTcp: this._forceTcp,
          producing: true,
          consuming: false,
          sctpCapabilities: this._useDataChannel
            ? this._mediasoupDevice!.sctpCapabilities
            : undefined,
        },
      );
      console.log(
        `${LOG_PREFIX} _createSendTransport: 收到 transportInfo:`,
        transportInfo,
      );

      const {
        id,
        iceParameters,
        iceCandidates,
        dtlsParameters,
        sctpParameters,
      } = transportInfo;

      // 創建發送傳輸
      console.log(
        `${LOG_PREFIX} _createSendTransport: 準備創建 mediasoup send transport...`,
      );
      console.log(
        `${LOG_PREFIX} _createSendTransport: Device 存在嗎?`,
        !!this._mediasoupDevice,
      );
      this._sendTransport = this._mediasoupDevice!.createSendTransport({
        id,
        iceParameters,
        iceCandidates,
        dtlsParameters: {
          ...dtlsParameters,
          role: 'auto',
        },
        sctpParameters,
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' },
        ],
        proprietaryConstraints: PC_PROPRIETARY_CONSTRAINTS,
      });
      console.log(
        `${LOG_PREFIX} _createSendTransport: mediasoup send transport 已創建:`,
        this._sendTransport,
      );

      // 監聽連接事件
      this._sendTransport.on(
        'connect',
        async ({ dtlsParameters }, callback, errback) => {
          try {
            await this._protoo!.request('connectWebRtcTransport', {
              transportId: this._sendTransport!.id,
              dtlsParameters,
            });

            callback();
          } catch (error: any) {
            errback(error);
          }
        },
      );

      // 監聽生產事件
      this._sendTransport.on(
        'produce',
        async ({ kind, rtpParameters, appData }, callback, errback) => {
          try {
            const { id } = await this._protoo!.request('produce', {
              transportId: this._sendTransport!.id,
              kind,
              rtpParameters,
              appData,
            });

            callback({ id });
          } catch (error: any) {
            errback(error);
          }
        },
      );
    } catch (error) {
      console.error(`${LOG_PREFIX} _createSendTransport 執行失敗:`, error);
      this._emitEvent(RoomEvent.ERROR, error);
      throw error;
    }
  }

  /**
   * 創建接收傳輸
   */
  private async _createRecvTransport(): Promise<void> {
    console.log(`${LOG_PREFIX} 創建接收傳輸`);
    console.log(`${LOG_PREFIX} _consume = ${this._consume}`);
    console.log(
      `${LOG_PREFIX} _mediasoupDevice = ${
        this._mediasoupDevice ? 'exists' : 'null'
      }`,
    );

    if (!this._consume) {
      console.error(`${LOG_PREFIX} 不想消費，跳過創建接收傳輸`);
      return;
    }

    if (!this._mediasoupDevice) {
      console.error(`${LOG_PREFIX} mediasoup 設備未初始化，無法創建接收傳輸`);
      return;
    }

    try {
      console.log(`${LOG_PREFIX} 請求創建 WebRTC 傳輸`);
      // 請求創建 WebRTC 傳輸
      const transportInfo = await this._protoo!.request(
        'createWebRtcTransport',
        {
          forceTcp: this._forceTcp,
          producing: false,
          consuming: true,
          sctpCapabilities: this._useDataChannel
            ? this._mediasoupDevice!.sctpCapabilities
            : undefined,
        },
      );

      console.log(`${LOG_PREFIX} 收到傳輸信息:`, transportInfo);

      const {
        id,
        iceParameters,
        iceCandidates,
        dtlsParameters,
        sctpParameters,
      } = transportInfo;

      // 創建接收傳輸
      this._recvTransport = this._mediasoupDevice!.createRecvTransport({
        id,
        iceParameters,
        iceCandidates,
        dtlsParameters: {
          ...dtlsParameters,
          role: 'auto',
        },
        sctpParameters,
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' },
        ],
      });

      // 監聽連接事件
      this._recvTransport.on(
        'connect',
        async ({ dtlsParameters }, callback, errback) => {
          try {
            await this._protoo!.request('connectWebRtcTransport', {
              transportId: this._recvTransport!.id,
              dtlsParameters,
            });

            callback();
          } catch (error: any) {
            errback(error);
          }
        },
      );
    } catch (error) {
      console.error(`${LOG_PREFIX} 創建接收傳輸失敗:`, error);
      this._emitEvent(RoomEvent.ERROR, error);
      throw error;
    }
  }
}
