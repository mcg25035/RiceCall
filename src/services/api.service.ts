/* eslint-disable @typescript-eslint/no-explicit-any */
import { errorHandler, StandardizedError } from '@/utils/errorHandler';

const API_URL = process.env.NEXT_PUBLIC_SERVER_URL;

type RequestOptions = {
  headers?: Record<string, string>;
  credentials?: RequestCredentials;
};

type ApiRequestData = {
  [key: string]: any;
};

const handleResponse = async (response: Response): Promise<any> => {
  try {
    const data = await response.json();
    console.log('data', data);
    if (!response.ok) {
      throw new StandardizedError(
        'ValidationError',
        data.error,
        'RESPONSE',
        'VALIDATION_ERROR',
        response.status,
      );
    }
    return data.data;
  } catch (error: Error | any) {
    if (!(error instanceof StandardizedError)) {
      error = new StandardizedError(
        'ServerError',
        `請求失敗: ${error.message}`,
        'RESPONSE',
        'EXCEPTION_ERROR',
        500,
      );
    }
    new errorHandler(error).show();
    return null;
  }
};

const apiService = {
  // GET request
  get: async (endpoint: string): Promise<any | null> => {
    try {
      // Fetch
      const response = await fetch(`${API_URL}${endpoint}`);
      // Handle response
      const result = await handleResponse(response);
      return result;
    } catch (error: Error | any) {
      if (!(error instanceof StandardizedError)) {
        error = new StandardizedError(
          'ServerError',
          `獲取資料時發生預期外的錯誤: ${error.message}`,
          'GET',
          'EXCEPTION_ERROR',
          500,
        );
      }
      new errorHandler(error).show();
      return null;
    }
  },

  // POST request
  post: async (
    endpoint: string,
    data: ApiRequestData | FormData,
    options?: RequestOptions,
  ): Promise<any | null> => {
    try {
      const headers = new Headers({
        ...(data instanceof FormData
          ? {}
          : { 'Content-Type': 'application/json' }),
        ...(options?.headers || {}),
      });

      const response = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: headers,
        credentials: options?.credentials || 'omit',
        body: data instanceof FormData ? data : JSON.stringify(data),
      });
      // Handle response
      const result = await handleResponse(response);
      return result;
    } catch (error: Error | any) {
      if (!(error instanceof StandardizedError)) {
        error = new StandardizedError(
          'ServerError',
          `提交資料時發生預期外的錯誤: ${error.message}`,
          'POST',
          'EXCEPTION_ERROR',
          500,
        );
      }
      new errorHandler(error).show();
      return null;
    }
  },

  // PATCH request
  patch: async (
    endpoint: string,
    data: Record<string, any>,
  ): Promise<any | null> => {
    try {
      // Fetch
      const response = await fetch(`${API_URL}${endpoint}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      // Handle response
      const result = await handleResponse(response);
      return result;
    } catch (error: Error | any) {
      if (!(error instanceof StandardizedError)) {
        error = new StandardizedError(
          'ServerError',
          `更新資料時發生預期外的錯誤: ${error.message}`,
          'PATCH',
          'EXCEPTION_ERROR',
          500,
        );
      }
      new errorHandler(error).show();
      return null;
    }
  },
};

export default apiService;
