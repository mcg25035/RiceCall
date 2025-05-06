import path from 'path';
import fs from 'fs/promises';

// Error
import StandardizedError from '@/error';

// Config
import { appConfig } from '@/config';

export default class ImagesService {
  constructor(private filePath: string[], private fileName: string) {
    this.filePath = filePath;
    this.fileName = fileName;
  }

  async use() {
    this.fileName = this.fileName.startsWith('__')
      ? this.fileName
      : `${appConfig.filePrefix}${this.fileName}`;

    const filePath = path.join(
      appConfig.uploadsDir,
      ...this.filePath,
      this.fileName,
    );

    const file = await fs.readFile(filePath).catch((error) => {
      if (error.code === 'ENOENT') {
        throw new StandardizedError({
          name: 'ServerError',
          message: '找不到檔案',
          part: 'GETFILE',
          tag: 'FILE_NOT_FOUND',
          statusCode: 404,
        });
      } else {
        throw new StandardizedError({
          name: 'ServerError',
          message: `讀取檔案失敗: ${error.message}`,
          part: 'GETFILE',
          tag: 'READ_FILE_FAILED',
          statusCode: 500,
        });
      }
    });

    return file;
  }
}
