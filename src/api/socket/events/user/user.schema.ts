import { z } from 'zod';

export const UserSchema = z.object({
  userId: z.string().length(36),
  name: z.string().min(1).max(32),
  avatar: z.string().min(0).max(255),
  avatarUrl: z.string().min(0).max(255),
  signature: z.string().min(0).max(100),
  country: z.string().min(0).max(100),
  birthYear: z.number().min(1900),
  birthMonth: z.number().min(1).max(12),
  birthDay: z.number().min(1).max(31),
  status: z.enum(['online', 'dnd', 'idle', 'gn']),
  gender: z.enum(['Male', 'Female']),
  currentServerId: z.string().length(36).nullable(),
  currentChannelId: z.string().length(36).nullable(),
});

export const SearchUserSchema = z
  .object({
    query: z.string(),
  })
  .strict();

export const UpdateUserSchema = z
  .object({
    userId: z.string(),
    user: UserSchema.partial(),
  })
  .strict();
