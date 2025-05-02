// Database
import { database } from '@/index';

export class RefreshFriendApplicationService {
  constructor(private senderId: string, private receiverId: string) {
    this.senderId = senderId;
    this.receiverId = receiverId;
  }

  async use() {
    const friendApplication = await database.get.friendApplication(
      this.senderId,
      this.receiverId,
    );
    return friendApplication;
  }
}
