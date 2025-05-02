// Database
import { database } from '@/index';

export const generateUniqueDisplayId = async (baseId = 20000000) => {
  const servers = (await database.get.all('servers')) || {};
  let displayId = baseId + Object.keys(servers).length;

  // Ensure displayId is unique
  while (
    Object.values(servers).some((server: any) => server.displayId === displayId)
  ) {
    displayId++;
  }

  return displayId;
};
