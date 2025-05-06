import { z } from 'zod';

export const UploadSchema = z
  .object({
    _type: z.any(),
    _fileName: z.any(),
    _file: z.any(),
  })
  .strict();
