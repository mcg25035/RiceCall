/* eslint-disable @typescript-eslint/no-require-imports */

const fs = require('fs/promises');
const path = require('path');

const deleteExtraUploads = async () => {
  const serverAvatarDir = path.join(__dirname, 'uploads', 'serverAvatars');
  const userAvatarDir = path.join(__dirname, 'uploads', 'userAvatars');
  const defaultServerAvatar = path.join(
    'uploads',
    'serverAvatars',
    '__default.png',
  );
  const defaultUserAvatar = path.join(
    'uploads',
    'userAvatars',
    '__default.png',
  );

  try {
    const serverAvatarFiles = await fs.readdir(serverAvatarDir);
    for (const file of serverAvatarFiles) {
      const filePath = path.join(serverAvatarDir, file);
      const relativePath = path.relative(__dirname, filePath);
      if (relativePath !== defaultServerAvatar) {
        await fs.unlink(filePath);
        console.log(`Deleted: ${relativePath}`);
      }
    }
    console.log('Extra server avatars deleted.');
  } catch (error) {
    console.error('Error deleting extra server avatars:', error);
  }

  try {
    const userAvatarFiles = await fs.readdir(userAvatarDir);
    for (const file of userAvatarFiles) {
      const filePath = path.join(userAvatarDir, file);
      const relativePath = path.relative(__dirname, filePath);
      if (relativePath !== defaultUserAvatar) {
        await fs.unlink(filePath);
        console.log(`Deleted: ${relativePath}`);
      }
    }
    console.log('Extra user avatars deleted.');
  } catch (error) {
    console.error('Error deleting extra user avatars:', error);
  }
};

const main = async () => {
  await deleteExtraUploads();
  await init();
};

main();
