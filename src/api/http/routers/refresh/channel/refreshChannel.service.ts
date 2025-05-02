// Database
import { database } from '@/index';

export class RefreshChannelService {
  constructor(private channelId: string) {
    this.channelId = channelId;
  }

  async use() {
    const channel = await database.get.channel(this.channelId);
    return channel;
  }
}
