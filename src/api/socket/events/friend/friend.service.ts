// Error
import StandardizedError from '@/error';

// Database
import { database } from '@/index';

export class CreateFriendService {
  constructor(
    private operatorId: string,
    private userId: string,
    private targetId: string,
    private preset: any,
  ) {
    this.operatorId = operatorId;
    this.userId = userId;
    this.targetId = targetId;
    this.preset = preset;
  }

  async use() {
    const friend = await database.get.friend(this.userId, this.targetId);

    if (friend) {
      throw new StandardizedError({
        name: 'PermissionError',
        message: '你已經是對方的好友',
        part: 'CREATEFRIEND',
        tag: 'FRIEND_EXISTS',
        statusCode: 400,
      });
    }

    if (this.operatorId !== this.userId) {
      throw new StandardizedError({
        name: 'PermissionError',
        message: '無法新增非自己的好友',
        part: 'CREATEFRIEND',
        tag: 'PERMISSION_DENIED',
        statusCode: 403,
      });
    }

    if (this.userId === this.targetId) {
      throw new StandardizedError({
        name: 'PermissionError',
        message: '無法將自己加入好友',
        part: 'CREATEFRIEND',
        tag: 'PERMISSION_DENIED',
        statusCode: 403,
      });
    }

    // Create friend
    await database.set.friend(this.userId, this.targetId, {
      ...this.preset,
      createdAt: Date.now(),
    });

    // Create friend (reverse)
    await database.set.friend(this.targetId, this.userId, {
      ...this.preset,
      createdAt: Date.now(),
    });

    return {
      userFriendAdd: await database.get.userFriend(this.userId, this.targetId),
      targetFriendAdd: await database.get.userFriend(
        this.targetId,
        this.userId,
      ),
    };
  }
}

export class UpdateFriendService {
  constructor(
    private operatorId: string,
    private userId: string,
    private targetId: string,
    private update: any,
  ) {
    this.operatorId = operatorId;
    this.userId = userId;
    this.targetId = targetId;
    this.update = update;
  }

  async use() {
    if (this.operatorId !== this.userId) {
      throw new StandardizedError({
        name: 'PermissionError',
        message: '無法修改非自己的好友',
        part: 'UPDATEFRIEND',
        tag: 'PERMISSION_DENIED',
        statusCode: 403,
      });
    }

    // Update friend
    await database.set.friend(this.userId, this.targetId, this.update);

    return {};
  }
}

export class DeleteFriendService {
  constructor(
    private operatorId: string,
    private userId: string,
    private targetId: string,
  ) {
    this.operatorId = operatorId;
    this.userId = userId;
    this.targetId = targetId;
  }

  async use() {
    if (this.operatorId !== this.userId) {
      throw new StandardizedError({
        name: 'PermissionError',
        message: '無法刪除非自己的好友',
        part: 'DELETEFRIEND',
        tag: 'PERMISSION_DENIED',
        statusCode: 403,
      });
    }

    // Delete friend
    await database.delete.friend(this.userId, this.targetId);

    // Delete friend (reverse)
    await database.delete.friend(this.targetId, this.userId);

    return {};
  }
}
