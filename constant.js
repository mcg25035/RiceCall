/* eslint-disable @typescript-eslint/no-require-imports */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const fs = require('fs').promises;

const XP_SYSTEM = {
  BASE_REQUIRE_XP: 25, // Base XP required for level up
  BASE_XP: 1, // Base XP gained per update
  GROWTH_RATE: 1.06, // XP requirement increases by 6% per level
  INTERVAL_MS: 60 * 60 * 1000, // 1 hours in milliseconds
};

const CLEANUP_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes in milliseconds

const MIME_TYPES = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
};

const PORT = process.env.PORT || 4500;
const SERVER_URL = process.env.SERVER_URL || 'http://localhost:4500';
const CONTENT_TYPE_JSON = { 'Content-Type': 'application/json' };

const UPLOADS_PATH = 'uploads';
const SERVER_AVATAR_PATH = 'serverAvatars';
const USER_AVATAR_PATH = 'userAvatars';
const BACKUP_PATH = 'backups';
const UPLOADS_DIR = path.join(__dirname, UPLOADS_PATH);
const SERVER_AVATAR_DIR = path.join(
  __dirname,
  UPLOADS_PATH,
  SERVER_AVATAR_PATH,
);
const BACKUP_DIR = path.join(__dirname, BACKUP_PATH);
const USER_AVATAR_DIR = path.join(__dirname, UPLOADS_PATH, USER_AVATAR_PATH);
fs.mkdir(UPLOADS_DIR, { recursive: true }).catch(console.error);
fs.mkdir(SERVER_AVATAR_DIR, { recursive: true }).catch(console.error);
fs.mkdir(USER_AVATAR_DIR, { recursive: true }).catch(console.error);
fs.mkdir(BACKUP_DIR, { recursive: true }).catch(console.error);

module.exports = {
  XP_SYSTEM,
  CLEANUP_INTERVAL_MS,
  PORT,
  SERVER_URL,
  MIME_TYPES,
  CONTENT_TYPE_JSON,
  UPLOADS_PATH,
  SERVER_AVATAR_PATH,
  USER_AVATAR_PATH,
  UPLOADS_DIR,
  SERVER_AVATAR_DIR,
  USER_AVATAR_DIR,
  BACKUP_DIR,
};
