import * as mediasoupClient from 'mediasoup-client';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { MediasoupRoom, PeerInfo, RoomEvent } from '../services/mediasoup';
import { useSocket } from './Socket';

// Mediasoup 上下文類型
interface MediasoupContextType {
  // 是否已連接
  connected: boolean;
  // 是否正在連接
  connecting: boolean;
  // 是否已啟用麥克風
  micEnabled: boolean;
  // 是否已靜音麥克風
  micMuted: boolean;
  // 對等體列表
  peers: Record<string, PeerInfo & { micPaused: boolean }>;
  // 遠端音頻流
  remoteAudioStreams: Record<string, MediaStream>;
  // 本地麥克風流
  localMicStream: MediaStream | null;
  // 啟用麥克風
  enableMic: () => Promise<void>;
  // 禁用麥克風
  disableMic: () => Promise<void>;
  // 靜音麥克風
  muteMic: () => void;
  // 取消靜音麥克風
  unmuteMic: () => void;
  // 加入房間
  joinRoom: (roomId: string) => Promise<void>;
  // 離開房間
  leaveRoom: () => void;
}

// 創建 Mediasoup 上下文
const MediasoupContext = createContext<MediasoupContextType | null>(null);

// Mediasoup 提供者屬性
interface MediasoupProviderProps {
  children: React.ReactNode;
}

/**
 * Mediasoup 提供者
 * @param props 屬性
 * @returns Mediasoup 提供者組件
 */
export const MediasoupProvider: React.FC<MediasoupProviderProps> = ({
  children,
}) => {
  const socket = useSocket();
  const roomRef = useRef<MediasoupRoom | null>(null);

  // 狀態管理
  const [connected, setConnected] = useState<boolean>(false);
  const [connecting, setConnecting] = useState<boolean>(false);
  const [micEnabled, setMicEnabled] = useState<boolean>(false);
  const [micMuted, setMicMuted] = useState<boolean>(false);
  const [peers, setPeers] = useState<
    Record<string, PeerInfo & { micPaused: boolean }>
  >({});
  const [remoteAudioStreams, setRemoteAudioStreams] = useState<
    Record<string, MediaStream>
  >({});
  const [localMicStream, setLocalMicStream] = useState<MediaStream | null>(
    null,
  );

  // --- 事件處理器 ---
  const handleConnecting = useCallback(() => {
    console.log('Provider: handleConnecting');
    setConnecting(true);
  }, []);

  const handleConnected = useCallback(() => {
    console.log('Provider: handleConnected');
    setConnected(true);
    setConnecting(false);
  }, []);

  const handleConnectionFailed = useCallback(() => {
    console.error('Provider: handleConnectionFailed');
    setConnected(false);
    setConnecting(false);
    roomRef.current = null;
  }, []);

  const handleDisconnected = useCallback(() => {
    console.log('Provider: handleDisconnected');
    setConnected(false);
    setConnecting(false);
  }, []);

  const handleClosed = useCallback(
    (closedPeerId: string) => {
      console.log(`Provider: handleClosed (來自 peerId: ${closedPeerId})`);
      if (roomRef.current && roomRef.current['_peerId'] === closedPeerId) {
        console.log(
          `Provider: Clearing state because the current room (in ref) was closed.`,
        );
        setConnected(false);
        setConnecting(false);
        setMicEnabled(false);
        setMicMuted(false);
        setPeers({});
        setRemoteAudioStreams({});
        if (localMicStream) {
          localMicStream.getTracks().forEach((t) => t.stop());
        }
        setLocalMicStream(null);
        roomRef.current = null;
      } else {
        console.log(
          `Provider: Room CLOSED event received, but it's not the current room in ref or ref is null. Ignoring state update.`,
        );
      }
    },
    [localMicStream],
  );

  const handleError = useCallback((error: any) => {
    console.error('Provider: handleError', error);
  }, []);

  const handleNewPeer = useCallback((peer: PeerInfo) => {
    console.log('Provider: handleNewPeer', peer);
    setPeers((prevPeers) => ({
      ...prevPeers,
      [peer.id]: { ...peer, micPaused: false },
    }));
  }, []);

  const handlePeerClosed = useCallback(({ peerId }: { peerId: string }) => {
    console.log('Provider: handlePeerClosed', peerId);
    setPeers((prevPeers) => {
      const newPeers = { ...prevPeers };
      delete newPeers[peerId];
      return newPeers;
    });
    setRemoteAudioStreams((prevStreams) => {
      const newStreams = { ...prevStreams };
      if (newStreams[peerId]) {
        newStreams[peerId].getTracks().forEach((track) => track.stop());
        delete newStreams[peerId];
        console.log('Provider: Removed audio stream for closed peer:', peerId);
      }
      return newStreams;
    });
  }, []);

  const handleMicEnabled = useCallback((stream: MediaStream) => {
    console.log('Provider: handleMicEnabled', stream);
    setMicEnabled(true);
    setMicMuted(false);
    setLocalMicStream(stream);
  }, []);

  const handleMicDisabled = useCallback(() => {
    console.log('Provider: handleMicDisabled');
    setMicEnabled(false);
    setMicMuted(false);
    if (localMicStream) {
      localMicStream.getTracks().forEach((track) => track.stop());
    }
    setLocalMicStream(null);
  }, [localMicStream]);

  const handleMicMuted = useCallback(() => {
    console.log('Provider: handleMicMuted');
    setMicMuted(true);
  }, []);

  const handleMicUnmuted = useCallback(() => {
    console.log('Provider: handleMicUnmuted');
    setMicMuted(false);
  }, []);

  const handleNewAudioConsumer = useCallback(
    ({
      consumer,
      peerId,
    }: {
      consumer: mediasoupClient.types.Consumer;
      audioElement: HTMLAudioElement;
      peerId: string;
    }) => {
      console.log('Provider: handleNewAudioConsumer', peerId);
      const { track } = consumer;
      if (!track) {
        console.error(
          'Provider: Received audio consumer without track!',
          peerId,
        );
        return;
      }
      // 記錄 Consumer 和 Track 狀態
      console.log(`Provider: Consumer state for peer ${peerId}: `, {
        id: consumer.id,
        paused: consumer.paused,
        closed: consumer.closed,
        track: {
          id: track.id,
          kind: track.kind,
          enabled: track.enabled,
          muted: track.muted,
          readyState: track.readyState,
        },
      });

      const stream = new MediaStream();
      stream.addTrack(track);
      setRemoteAudioStreams((prevStreams) => ({
        ...prevStreams,
        [peerId]: stream,
      }));

      const onTransportClose = () => {
        console.log(`Provider: Consumer transportclose for peer ${peerId}`);
        setRemoteAudioStreams((prevStreams) => {
          const newStreams = { ...prevStreams };
          if (newStreams[peerId]) {
            newStreams[peerId].getTracks().forEach((t) => t.stop());
            delete newStreams[peerId];
          }
          return newStreams;
        });
        consumer.removeListener('transportclose', onTransportClose);
        consumer.removeListener('trackended', onTrackEnded);
      };

      const onTrackEnded = () => {
        console.log(`Provider: Consumer trackended for peer ${peerId}`);
        setRemoteAudioStreams((prevStreams) => {
          const newStreams = { ...prevStreams };
          if (newStreams[peerId]) {
            newStreams[peerId].getTracks().forEach((t) => t.stop());
            delete newStreams[peerId];
          }
          return newStreams;
        });
        consumer.removeListener('transportclose', onTransportClose);
        consumer.removeListener('trackended', onTrackEnded);
      };

      consumer.on('transportclose', onTransportClose);
      consumer.on('trackended', onTrackEnded);
    },
    [],
  );

  const handlePeerProducerPaused = useCallback(
    ({ peerId }: { peerId: string }) => {
      console.log(`Provider: handlePeerProducerPaused for peer ${peerId}`);
      setPeers((prevPeers) => {
        if (!prevPeers[peerId]) return prevPeers;
        return {
          ...prevPeers,
          [peerId]: { ...prevPeers[peerId], micPaused: true },
        };
      });
    },
    [],
  );

  const handlePeerProducerResumed = useCallback(
    ({ peerId }: { peerId: string }) => {
      console.log(`Provider: handlePeerProducerResumed for peer ${peerId}`);
      setPeers((prevPeers) => {
        if (!prevPeers[peerId]) return prevPeers;
        return {
          ...prevPeers,
          [peerId]: { ...prevPeers[peerId], micPaused: false },
        };
      });
    },
    [],
  );

  // --- 主控制函數 ---
  const joinRoom = useCallback(
    async (roomId: string): Promise<void> => {
      if (connecting || connected || roomRef.current) {
        console.log(
          `joinRoom: Aborting. (connecting=${connecting}, connected=${connected}, roomRef=${!!roomRef.current})`,
        );
        return;
      }

      console.log('joinRoom: Starting...');
      setConnecting(true);
      setConnected(false);
      setPeers({});
      setRemoteAudioStreams({});
      setLocalMicStream(null);
      setMicEnabled(false);
      setMicMuted(false);

      try {
        const peerId = `user-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        console.log(`joinRoom: Creating MediasoupRoom with peerId: ${peerId}`);
        const newRoom = new MediasoupRoom({
          roomId,
          peerId: peerId,
          displayName: `user-${Date.now()}`,
          device: {
            flag: 'chrome',
            name: 'Chrome',
            version: '90.0.4430.212',
          },
        });
        roomRef.current = newRoom;

        newRoom.on(RoomEvent.CONNECTING, handleConnecting);
        newRoom.on(RoomEvent.CONNECTED, handleConnected);
        newRoom.on(RoomEvent.CONNECTION_FAILED, handleConnectionFailed);
        newRoom.on(RoomEvent.DISCONNECTED, handleDisconnected);
        newRoom.on(RoomEvent.CLOSED, () => handleClosed(newRoom['_peerId']));
        newRoom.on(RoomEvent.ERROR, handleError);
        newRoom.on(RoomEvent.NEW_PEER, handleNewPeer);
        newRoom.on(RoomEvent.PEER_CLOSED, handlePeerClosed);
        newRoom.on(RoomEvent.MIC_ENABLED, handleMicEnabled);
        newRoom.on(RoomEvent.MIC_DISABLED, handleMicDisabled);
        newRoom.on(RoomEvent.MIC_MUTED, handleMicMuted);
        newRoom.on(RoomEvent.MIC_UNMUTED, handleMicUnmuted);
        newRoom.on(RoomEvent.NEW_AUDIO_CONSUMER, handleNewAudioConsumer);
        newRoom.on(RoomEvent.PEER_PRODUCER_PAUSED, handlePeerProducerPaused);
        newRoom.on(RoomEvent.PEER_PRODUCER_RESUMED, handlePeerProducerResumed);

        console.log('joinRoom: Calling newRoom.join()...');
        await newRoom.join();
        console.log('joinRoom: newRoom.join() completed.');
      } catch (error) {
        console.error('joinRoom: Caught error:', error);
        setConnecting(false);
        if (roomRef.current) {
          roomRef.current.close();
          roomRef.current = null;
        }
      }
    },
    [
      connecting,
      connected,
      handleConnecting,
      handleConnected,
      handleConnectionFailed,
      handleDisconnected,
      handleClosed,
      handleError,
      handleNewPeer,
      handlePeerClosed,
      handleMicEnabled,
      handleMicDisabled,
      handleMicMuted,
      handleMicUnmuted,
      handleNewAudioConsumer,
      handlePeerProducerPaused,
      handlePeerProducerResumed,
    ],
  );

  const leaveRoom = useCallback((): void => {
    if (roomRef.current) {
      console.log(`leaveRoom: Closing room ${roomRef.current['_peerId']}`);
      roomRef.current.close();
    } else {
      console.log('leaveRoom: No room instance found in ref.');
    }
  }, []);

  // --- Microphone Actions ---
  const enableMic = useCallback(async (): Promise<void> => {
    if (roomRef.current && connected) {
      try {
        console.log('enableMic: Calling roomRef.current.enableMic()');
        await roomRef.current.enableMic();
      } catch (error) {
        console.error('enableMic failed:', error);
        handleError(error);
      }
    } else {
      console.warn('enableMic: Room not ready or not connected.');
    }
  }, [connected, handleError]);

  const disableMic = useCallback(async (): Promise<void> => {
    if (roomRef.current && connected) {
      try {
        console.log('disableMic: Calling roomRef.current.disableMic()');
        await roomRef.current.disableMic();
      } catch (error) {
        console.error('disableMic failed:', error);
        handleError(error);
      }
    } else {
      console.warn('disableMic: Room not ready or not connected.');
    }
  }, [connected, handleError]);

  const muteMic = useCallback((): void => {
    if (roomRef.current && connected && micEnabled) {
      console.log('muteMic: Calling roomRef.current.muteMic()');
      roomRef.current.muteMic();
    } else {
      console.warn(
        'muteMic: Room not ready, not connected, or mic not enabled.',
      );
    }
  }, [connected, micEnabled]);

  const unmuteMic = useCallback((): void => {
    if (roomRef.current && connected && micEnabled) {
      console.log('unmuteMic: Calling roomRef.current.unmuteMic()');
      roomRef.current.unmuteMic();
    } else {
      console.warn(
        'unmuteMic: Room not ready, not connected, or mic not enabled.',
      );
    }
  }, [connected, micEnabled]);

  // --- Effect for UNMOUNT cleanup ---
  useEffect(() => {
    console.log('MediasoupProvider Mount Effect: Setup complete.');
    return () => {
      if (roomRef.current) {
        console.log(
          `MediasoupProvider UNMOUNT Cleanup: Closing room ${roomRef.current['_peerId']}`,
        );
        roomRef.current.close();
        roomRef.current = null;
      } else {
        console.log(
          'MediasoupProvider UNMOUNT Cleanup: No room instance in ref.',
        );
      }
    };
  }, []);

  // Context value
  const contextValue: MediasoupContextType = {
    connected,
    connecting,
    micEnabled,
    micMuted,
    peers,
    remoteAudioStreams,
    localMicStream,
    enableMic,
    disableMic,
    muteMic,
    unmuteMic,
    joinRoom,
    leaveRoom,
  };

  return (
    <MediasoupContext.Provider value={contextValue}>
      {children}
    </MediasoupContext.Provider>
  );
};

/**
 * 使用 Mediasoup 上下文
 * @returns Mediasoup 上下文
 */
export const useMediasoup = (): MediasoupContextType => {
  const context = useContext(MediasoupContext);

  if (!context) {
    throw new Error('useMediasoup 必須在 MediasoupProvider 內使用');
  }

  return context;
};
