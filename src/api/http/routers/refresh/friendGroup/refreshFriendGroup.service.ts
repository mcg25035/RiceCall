// Database
import { database } from '@/index';

export class RefreshFriendGroupService {
  constructor(private friendGroupId: string) {
    this.friendGroupId = friendGroupId;
  }

  async use() {
    const friendGroup = await database.get.friendGroup(this.friendGroupId);
    return friendGroup;
  }
}
