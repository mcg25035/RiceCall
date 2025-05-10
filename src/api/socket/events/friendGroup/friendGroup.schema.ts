import { z } from 'zod';

export const FriendGroupSchema = z.object({
  friendGroupId: z.string().length(36),
  name: z.string().min(1).max(32),
  order: z.number().min(0).max(9999),
  userId: z.string().length(36),
});

export const CreateFriendGroupSchema = z
  .object({
    userId: z.string().length(36),
    group: FriendGroupSchema.partial(),
  })
  .strict();

export const UpdateFriendGroupSchema = z
  .object({
    userId: z.string().length(36),
    friendGroupId: z.string().length(36),
    group: FriendGroupSchema.partial(),
  })
  .strict();

export const DeleteFriendGroupSchema = z
  .object({
    userId: z.string().length(36),
    friendGroupId: z.string().length(36),
  })
  .strict();
