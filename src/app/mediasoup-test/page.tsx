'use client';

import MediasoupDemo from '@/components/MediasoupDemo';
import { MediasoupProvider } from '@/providers/Mediasoup';
import React, { useState } from 'react';

/**
 * Mediasoup 測試頁面
 * @returns Mediasoup 測試頁面組件
 */
const MediasoupTestPage: React.FC = () => {
  const [roomId, setRoomId] = useState<string>('dev');
  const [showDemo, setShowDemo] = useState<boolean>(false);

  const handleJoin = () => {
    setShowDemo(true);
  };

  return (
    <MediasoupProvider>
      <div
        className="mediasoup-test-page"
        style={{
          maxWidth: '800px',
          margin: '0 auto',
          padding: '40px 20px',
          fontFamily: 'Arial, sans-serif',
          overflow: 'auto',
        }}
      >
        <h1
          style={{
            textAlign: 'center',
            marginBottom: '20px',
            color: '#333',
            fontSize: '2rem',
          }}
        >
          Mediasoup 測試
        </h1>

        <div
          style={{
            backgroundColor: '#e6f7ff',
            padding: '15px',
            borderRadius: '6px',
            marginBottom: '30px',
            border: '1px solid #91d5ff',
          }}
        >
          <h3 style={{ margin: '0 0 10px 0', color: '#0050b3' }}>
            如何測試回音功能
          </h3>
          <ol style={{ margin: '0', paddingLeft: '20px' }}>
            <li>在兩個不同的瀏覽器視窗中打開此頁面（或使用無痕模式）</li>
            <li>在兩個視窗中輸入相同的房間 ID</li>
            <li>在兩個視窗中都點擊「加入房間」</li>
            <li>在其中一個視窗中啟用麥克風並說話</li>
            <li>您應該能在另一個視窗中聽到自己的聲音</li>
          </ol>
        </div>

        {!showDemo ? (
          <div
            className="join-form"
            style={{
              maxWidth: '400px',
              margin: '0 auto',
              padding: '30px',
              backgroundColor: '#f8f9fa',
              borderRadius: '10px',
              boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
              textAlign: 'center',
            }}
          >
            <h2 style={{ marginTop: 0, marginBottom: '20px', color: '#444' }}>
              加入語音房間
            </h2>
            <input
              type="text"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              placeholder="輸入房間 ID"
              style={{
                width: '100%',
                padding: '12px 15px',
                fontSize: '16px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                marginBottom: '20px',
                boxSizing: 'border-box',
              }}
            />
            <button
              onClick={handleJoin}
              style={{
                backgroundColor: '#4a6cf7',
                color: 'white',
                border: 'none',
                padding: '12px 24px',
                fontSize: '16px',
                borderRadius: '4px',
                cursor: 'pointer',
                transition: 'background-color 0.3s',
              }}
            >
              加入房間
            </button>
          </div>
        ) : (
          <>
            <button
              onClick={() => setShowDemo(false)}
              style={{
                backgroundColor: '#6c757d',
                color: 'white',
                border: 'none',
                padding: '8px 16px',
                fontSize: '14px',
                borderRadius: '4px',
                cursor: 'pointer',
                marginBottom: '20px',
                display: 'block',
              }}
            >
              返回
            </button>
            <MediasoupDemo roomId={roomId} />
          </>
        )}
      </div>
    </MediasoupProvider>
  );
};

export default MediasoupTestPage;
