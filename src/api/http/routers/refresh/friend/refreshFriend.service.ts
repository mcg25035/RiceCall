// Database
import { database } from '@/index';

export class RefreshFriendService {
  constructor(private userId: string, private targetId: string) {
    this.userId = userId;
    this.targetId = targetId;
  }

  async use() {
    const friend = await database.get.friend(this.userId, this.targetId);
    return friend;
  }
}
