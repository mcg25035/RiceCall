/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { createContext, useContext, useEffect, useRef, useState } from 'react';

// Types
import { SocketServerEvent, SocketClientEvent } from '@/types';

// Services
import ipcService from '@/services/ipc.service';

type SocketContextType = {
  send: Record<SocketClientEvent, (...args: any[]) => () => void>;
  on: Record<
    SocketServerEvent,
    (callback: (...args: any[]) => void) => () => void
  >;
  isConnected: boolean;
};

const SocketContext = createContext<SocketContextType | null>(null);

export const useSocket = (): SocketContextType => {
  const context = useContext(SocketContext);
  if (!context || !context.on || !context.send)
    throw new Error('useSocket must be used within a SocketProvider');
  return context;
};

interface SocketProviderProps {
  children: React.ReactNode;
}

const SocketProvider = ({ children }: SocketProviderProps) => {
  // States
  const [on, setOn] = useState<SocketContextType['on']>(
    Object.values(SocketServerEvent).reduce((acc, event) => {
      acc[event] = (callback: (...args: any[]) => void) => {
        ipcService.onSocketEvent(event, (...args) => callback(...args));
        return () => ipcService.removeListener(event);
      };
      return acc;
    }, {} as SocketContextType['on']),
  );
  const [send, setSend] = useState<SocketContextType['send']>(
    Object.values(SocketClientEvent).reduce((acc, event) => {
      acc[event] = (...args: any[]) => {
        ipcService.sendSocketEvent(event, ...args);
        return () => {};
      };
      return acc;
    }, {} as SocketContextType['send']),
  );

  // Refs
  const cleanupRef = useRef<(() => void)[]>([]);

  // States
  const [isConnected, setIsConnected] = useState(false);

  // Handlers
  const handleConnect = () => {
    console.info('Socket connected');
    setIsConnected(true);
  };

  const handleDisconnect = () => {
    console.info('Socket disconnected');
    setIsConnected(false);
  };

  const handleReconnect = (attemptNumber: number) => {
    console.info('Socket reconnected', attemptNumber);
  };

  // Effects
  useEffect(() => {
    console.info('SocketProvider initialization');

    cleanupRef.current = Object.values(SocketServerEvent).reduce(
      (acc, event) => {
        acc.push(() => ipcService.removeListener(event));
        return acc;
      },
      [] as (() => void)[],
    );

    cleanupRef.current.push(() => {
      ipcService.removeListener('connect');
      ipcService.removeListener('connect_error');
      ipcService.removeListener('reconnect');
      ipcService.removeListener('reconnect_error');
      ipcService.removeListener('disconnect');
    });

    setOn(
      Object.values(SocketServerEvent).reduce((acc, event) => {
        acc[event] = (callback: (...args: any[]) => void) => {
          ipcService.onSocketEvent(event, (...args) => callback(...args));
          return () => ipcService.removeListener(event);
        };
        return acc;
      }, {} as SocketContextType['on']),
    );

    setSend(
      Object.values(SocketClientEvent).reduce((acc, event) => {
        acc[event] = (...args: any[]) => {
          ipcService.sendSocketEvent(event, ...args);
          return () => {};
        };
        return acc;
      }, {} as SocketContextType['send']),
    );

    ipcService.onSocketEvent('connect', handleConnect);
    ipcService.onSocketEvent('reconnect', handleReconnect);
    ipcService.onSocketEvent('disconnect', handleDisconnect);

    return () => {
      console.info('SocketProvider cleanup');
      cleanupRef.current.forEach((cleanup) => cleanup());
      cleanupRef.current = [];
    };
  }, []);

  return (
    <SocketContext.Provider value={{ on, send, isConnected }}>
      {children}
    </SocketContext.Provider>
  );
};

SocketProvider.displayName = 'SocketProvider';

export default SocketProvider;
