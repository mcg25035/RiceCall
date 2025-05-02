import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';

// Database
import { database } from '@/index';

// Config
import { serverConfig } from '@/config';

export default class RegisterService {
  constructor(
    private account: string,
    private password: string,
    private username: string,
  ) {
    this.account = account;
    this.password = password;
    this.username = username;
  }

  async use() {
    // Create user data
    const userId = uuidv4();
    await database.set.user(userId, {
      name: this.username,
      avatar: userId,
      avatarUrl: `data:image/png;base64,${serverConfig.url}:${serverConfig.port}/images/userAvatars/`,
      createdAt: Date.now(),
    });

    // Create account password list
    const hashedPassword = await bcrypt.hash(this.password, 10);
    await database.set.account(this.account, {
      password: hashedPassword,
      userId: userId,
    });

    return { account: this.account };
  }
}
