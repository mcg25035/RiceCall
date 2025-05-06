import fs from 'fs/promises';
import path from 'path';
import sharp from 'sharp';

// Error
import StandardizedError from '@/error';

// Config
import { appConfig, serverConfig } from '@/config';

export default class UploadService {
  constructor(
    private type: string,
    private fileName: string,
    private file: string,
  ) {
    this.type = type;
    this.fileName = fileName;
    this.file = file;
  }

  async use() {
    const directory = (type: string) => {
      switch (type) {
        case 'server':
          return appConfig.serverAvatarDir;
        case 'user':
          return appConfig.userAvatarDir;
        default:
          return appConfig.uploadsDir;
      }
    };

    const matches = this.file.match(/^data:image\/(.*?);base64,/);
    if (!matches) {
      throw new StandardizedError({
        name: 'ValidationError',
        message: '無效的檔案',
        part: 'UPLOAD',
        tag: 'INVALID_FILE_TYPE',
        statusCode: 400,
      });
    }
    const ext = matches[1];
    if (!Object.keys(appConfig.allowedMimeTypes).includes(`.${ext}`)) {
      throw new StandardizedError({
        name: 'ValidationError',
        message: '無效的檔案類型',
        part: 'UPLOAD',
        tag: 'INVALID_FILE_TYPE',
        statusCode: 400,
      });
    }
    const fullFileName = `${this.fileName}.webp`;
    const PrefixFileName = `${appConfig.filePrefix}${this.fileName}.webp`;
    const filePath = directory(this.type);
    const fileBase64 = this.file.split(',')[1];

    const imageBuffer = Buffer.from(fileBase64, 'base64');

    const files = await fs.readdir(filePath);
    const matchingFiles = files.filter(
      (fileName: string) =>
        fileName === fullFileName && !fileName.startsWith('__'),
    );

    await Promise.all(
      matchingFiles.map((fileName) =>
        fs.unlink(path.join(filePath, fileName)).catch((err) => {
          throw new StandardizedError({
            name: 'ServerError',
            message: `刪除圖片失敗: ${err.message}`,
            part: 'UPLOAD',
            tag: 'SERVER_ERROR',
            statusCode: 500,
          });
        }),
      ),
    );

    sharp(imageBuffer)
      .webp({ quality: 80 })
      .toFile(path.join(filePath, PrefixFileName))
      .catch((err) => {
        throw new StandardizedError({
          name: 'ServerError',
          message: `轉換圖片失敗: ${err.message}`,
          part: 'UPLOAD',
          tag: 'SERVER_ERROR',
          statusCode: 500,
        });
      });

    // Return Image Name Example:
    // "test"

    // Return Image URL Example:
    // 'http://localhost:4500/images/test.jpg'

    return {
      avatar: this.fileName,
      avatarUrl: `${serverConfig.url}:${serverConfig.port}/${filePath.replace(
        'uploads',
        'images',
      )}/${fullFileName}`,
    };
  }
}
