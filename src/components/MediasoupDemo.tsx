import { useMediasoup } from '@/providers/Mediasoup';
import { useSocket } from '@/providers/Socket';
import React, { useEffect, useRef, useState } from 'react';

// 定義一個子組件來處理單個音頻流
interface AudioPlayerProps {
  stream: MediaStream;
  peerId: string;
}

const AudioPlayer: React.FC<AudioPlayerProps> = ({ stream, peerId }) => {
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const audioElement = audioRef.current;

    // --- Define Event Handlers --- (Define them here so cleanup can access)
    const handleCanPlay = () => {
      if (!audioElement) return;
      console.log(
        `AudioPlayer (${peerId}): Event - canplay. Attempting to play...`,
      );
      const playPromise = audioElement.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            console.log(
              `AudioPlayer (${peerId}): Playback started successfully after canplay.`,
            );
          })
          .catch((error) => {
            console.error(
              `AudioPlayer (${peerId}): Playback failed after canplay.`,
              error,
            );
            if (error.name === 'NotAllowedError') {
              console.warn(
                `AudioPlayer (${peerId}): Autoplay was prevented. User interaction likely required.`,
              );
            }
          });
      } else {
        console.log(
          `AudioPlayer (${peerId}): play() did not return a promise after canplay.`,
        );
      }
    };

    const handleLoadedMetadata = () =>
      console.log(`AudioPlayer (${peerId}): Event - loadedmetadata`);
    const handlePlay = () =>
      console.log(`AudioPlayer (${peerId}): Event - play`);
    const handlePlaying = () =>
      console.log(`AudioPlayer (${peerId}): Event - playing`);
    const handlePause = () =>
      console.log(`AudioPlayer (${peerId}): Event - pause`);
    const handleError = (e: Event | string) =>
      console.error(
        `AudioPlayer (${peerId}): Event - error`,
        e instanceof Event ? (e.target as HTMLAudioElement)?.error : e,
      );
    // -----------------------------

    if (audioElement && stream) {
      console.log(
        `AudioPlayer (${peerId}): useEffect - Attaching stream:`,
        stream,
      );
      audioElement.srcObject = stream;
      console.log(`AudioPlayer (${peerId}): srcObject set.`);

      // Attach listeners using the handlers defined above
      audioElement.addEventListener('canplay', handleCanPlay);
      audioElement.addEventListener('loadedmetadata', handleLoadedMetadata);
      audioElement.addEventListener('play', handlePlay);
      audioElement.addEventListener('playing', handlePlaying);
      audioElement.addEventListener('pause', handlePause);
      audioElement.addEventListener('error', handleError);

      console.log(`AudioPlayer (${peerId}): Event listeners attached.`);
    } else {
      console.log(
        `AudioPlayer (${peerId}): useEffect - Ref or stream not ready.`,
      );
    }

    // --- Cleanup Function ---
    return () => {
      if (audioElement) {
        console.log(
          `AudioPlayer (${peerId}): Cleanup effect - Removing listeners.`,
        );
        // Remove listeners using the same function references
        audioElement.removeEventListener('canplay', handleCanPlay);
        audioElement.removeEventListener(
          'loadedmetadata',
          handleLoadedMetadata,
        );
        audioElement.removeEventListener('play', handlePlay);
        audioElement.removeEventListener('playing', handlePlaying);
        audioElement.removeEventListener('pause', handlePause);
        audioElement.removeEventListener('error', handleError);
      }
    };
  }, [stream, peerId]);

  return (
    <audio
      ref={audioRef}
      playsInline
      controls
      muted={peerId === 'local'}
      style={{ display: 'block', marginTop: '5px' }}
    />
  );
};

interface MediasoupDemoProps {
  roomId: string;
}

/**
 * Mediasoup 示例組件
 * @param props 屬性
 * @returns Mediasoup 示例組件
 */
const MediasoupDemo: React.FC<MediasoupDemoProps> = ({ roomId }) => {
  const mediasoup = useMediasoup();
  const socket = useSocket();
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  // 加入房間
  useEffect(() => {
    // 如果已經連接到 mediasoup，不重新加入
    if (mediasoup.connected || mediasoup.connecting) {
      return;
    }

    // 加入房間的函數
    const joinRoom = async () => {
      try {
        console.log('joinRoom', roomId);
        await mediasoup.joinRoom(roomId);
        console.log('joinRoom success');
      } catch (error: any) {
        setError(error.message || '加入房間失敗');
      }
    };

    // 執行加入房間
    joinRoom();

    // 清理函數
    return () => {
      mediasoup.leaveRoom();
    };
  }, [roomId]);

  // 處理麥克風
  const handleMic = async () => {
    console.log('處理麥克風按鈕點擊');
    console.log('當前狀態:', {
      micEnabled: mediasoup.micEnabled,
      micMuted: mediasoup.micMuted,
      connected: mediasoup.connected,
    });

    try {
      if (mediasoup.micEnabled) {
        if (mediasoup.micMuted) {
          console.log('嘗試取消靜音麥克風');
          mediasoup.unmuteMic();
          console.log('取消靜音麥克風成功');
        } else {
          console.log('嘗試靜音麥克風');
          mediasoup.muteMic();
          console.log('靜音麥克風成功');
        }
      } else {
        console.log('嘗試啟用麥克風');
        await mediasoup.enableMic();
        console.log('啟用麥克風成功');
      }
    } catch (error: any) {
      console.error('麥克風操作失敗:', error);
      setError(error.message || '麥克風操作失敗');
    }
  };

  // 獲取麥克風按鈕文本
  const getMicButtonText = () => {
    if (!mediasoup.micEnabled) {
      return '啟用麥克風';
    }
    return mediasoup.micMuted ? '取消靜音' : '靜音';
  };

  // 測試音頻播放
  const testAudio = () => {
    try {
      console.log('測試音頻播放');
      const audioContext = new (window.AudioContext ||
        (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.type = 'sine';
      oscillator.frequency.value = 440; // A4 音符
      gainNode.gain.value = 0.1; // 音量設置為較低

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.start();

      // 播放 1 秒後停止
      setTimeout(() => {
        oscillator.stop();
        console.log('測試音頻播放完成');
      }, 1000);

      setError(null);
    } catch (err: any) {
      console.error('測試音頻播放失敗:', err);
      setError('測試音頻播放失敗: ' + err.message);
    }
  };

  // 播放測試音頻文件
  const playTestAudioFile = () => {
    try {
      if (audioRef.current) {
        console.log('嘗試播放測試音頻文件');
        audioRef.current
          .play()
          .then(() => {
            console.log('測試音頻文件播放成功');
            setError(null);
          })
          .catch((err) => {
            console.error('測試音頻文件播放失敗:', err);
            setError('測試音頻文件播放失敗: ' + err.message);
          });
      }
    } catch (err: any) {
      console.error('播放測試音頻文件錯誤:', err);
      setError('播放測試音頻文件錯誤: ' + err.message);
    }
  };

  return (
    <div
      className="mediasoup-demo"
      style={{
        maxWidth: '600px',
        margin: '0 auto',
        padding: '20px',
        backgroundColor: '#f5f5f5',
        borderRadius: '8px',
        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
        overflow: 'auto',
      }}
    >
      <h2 style={{ textAlign: 'center', marginBottom: '20px' }}>
        Mediasoup 示例
      </h2>

      <div
        style={{
          backgroundColor: '#fff',
          padding: '15px',
          borderRadius: '6px',
          marginBottom: '20px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
        }}
      >
        <p style={{ margin: '8px 0' }}>
          <strong>房間 ID:</strong> {roomId}
        </p>
        <p style={{ margin: '8px 0' }}>
          <strong>Socket 連接狀態:</strong>
          <span style={{ color: socket?.isConnected ? 'green' : 'red' }}>
            {socket?.isConnected ? '已連接' : '未連接'}
          </span>
        </p>
        <p style={{ margin: '8px 0' }}>
          <strong>Mediasoup 連接狀態:</strong>
          <span style={{ color: mediasoup.connected ? 'green' : 'red' }}>
            {mediasoup.connected ? '已連接' : '未連接'}
          </span>
        </p>
        <p style={{ margin: '8px 0' }}>
          <strong>遠端音頻流數量:</strong>{' '}
          {Object.keys(mediasoup.remoteAudioStreams).length}
        </p>
        {mediasoup.connecting && (
          <p style={{ margin: '8px 0', color: 'blue' }}>正在連接...</p>
        )}
        {error && (
          <p
            className="error"
            style={{ margin: '8px 0', color: 'red', fontWeight: 'bold' }}
          >
            錯誤: {error}
          </p>
        )}
      </div>

      <div
        className="controls"
        style={{
          display: 'flex',
          gap: '10px',
          marginBottom: '20px',
          justifyContent: 'center',
        }}
      >
        <button
          onClick={() => handleMic()}
          disabled={mediasoup.connecting}
          style={{
            padding: '8px 16px',
            backgroundColor: mediasoup.micEnabled
              ? mediasoup.micMuted
                ? 'orange'
                : 'green'
              : 'blue',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            opacity: mediasoup.connecting ? 0.6 : 1,
          }}
        >
          {getMicButtonText()}
        </button>
        <button
          onClick={() => mediasoup.leaveRoom()}
          disabled={!mediasoup.connected || mediasoup.connecting}
          style={{
            padding: '8px 16px',
            backgroundColor: 'red',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            opacity: !mediasoup.connected || mediasoup.connecting ? 0.6 : 1,
          }}
        >
          離開房間
        </button>
        <button
          onClick={testAudio}
          style={{
            padding: '8px 16px',
            backgroundColor: '#6c757d',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          測試音頻
        </button>
        <button
          onClick={playTestAudioFile}
          style={{
            padding: '8px 16px',
            backgroundColor: '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          播放測試音頻文件
        </button>
      </div>

      {/* 測試音頻元素 */}
      <audio
        ref={audioRef}
        src="https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3"
        style={{ display: 'none' }}
        controls
      />

      {/* 新增：本地麥克風預覽 */}
      {mediasoup.localMicStream && (
        <div
          className="local-audio-preview"
          style={{
            marginTop: '20px',
            backgroundColor: '#e8f5e9', // 淡綠色背景
            padding: '15px',
            borderRadius: '6px',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
          }}
        >
          <h3
            style={{
              marginTop: 0,
              borderBottom: '1px solid #c8e6c9',
              paddingBottom: '8px',
              color: '#1b5e20', // 深綠色文字
            }}
          >
            本地麥克風預覽
          </h3>
          <AudioPlayer stream={mediasoup.localMicStream} peerId="local" />
        </div>
      )}

      <div
        className="peers"
        style={{
          backgroundColor: '#fff',
          padding: '15px',
          borderRadius: '6px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
        }}
      >
        <h3
          style={{
            marginTop: 0,
            borderBottom: '1px solid #eee',
            paddingBottom: '8px',
          }}
        >
          對等體列表 ({Object.keys(mediasoup.peers).length})
        </h3>
        {Object.keys(mediasoup.peers).length === 0 ? (
          <p style={{ color: '#666', fontStyle: 'italic' }}>沒有其他對等體</p>
        ) : (
          <ul style={{ listStyleType: 'none', padding: 0 }}>
            {Object.entries(mediasoup.peers).map(
              ([peerId, peer]: [string, any]) => (
                <li
                  key={peerId}
                  style={{
                    padding: '8px',
                    borderBottom: '1px solid #f0f0f0',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  <div
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '50%',
                      backgroundColor: '#e0e0e0',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: '10px',
                      fontWeight: 'bold',
                      color: '#555',
                    }}
                  >
                    {peer.displayName.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontWeight: 'bold' }}>{peer.displayName}</div>
                    <div style={{ fontSize: '0.8em', color: '#666' }}>
                      {peer.device?.name || '未知設備'}
                      {peer.micPaused && (
                        <span
                          style={{
                            marginLeft: '8px',
                            color: 'orange',
                            fontStyle: 'italic',
                          }}
                        >
                          (已靜音)
                        </span>
                      )}
                    </div>
                  </div>
                </li>
              ),
            )}
          </ul>
        )}
      </div>

      {/* 新增：遠端音頻播放器 */}
      <div
        className="remote-audios"
        style={{
          marginTop: '20px',
          backgroundColor: '#fff',
          padding: '15px',
          borderRadius: '6px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
        }}
      >
        <h3
          style={{
            marginTop: 0,
            borderBottom: '1px solid #eee',
            paddingBottom: '8px',
          }}
        >
          遠端音頻
        </h3>
        {Object.keys(mediasoup.remoteAudioStreams).length === 0 ? (
          <p style={{ color: '#666', fontStyle: 'italic' }}>沒有遠端音頻</p>
        ) : (
          Object.entries(mediasoup.remoteAudioStreams).map(
            ([peerId, stream]) => (
              <div key={peerId} style={{ marginBottom: '10px' }}>
                <p style={{ margin: '0 0 5px 0', fontWeight: 'bold' }}>
                  來自 Peer: {mediasoup.peers[peerId]?.displayName || peerId}
                </p>
                <AudioPlayer stream={stream} peerId={peerId} />
              </div>
            ),
          )
        )}
      </div>
    </div>
  );
};

export default MediasoupDemo;
