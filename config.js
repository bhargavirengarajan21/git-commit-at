import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { homedir } from 'os';
import path from 'path';

const CONFIG_DIR = path.join(homedir(), '.git-commit-at');
const CONFIG_PATH = path.join(CONFIG_DIR, 'config.json');
const LOGS_PATH = path.join(CONFIG_DIR, 'logs.json');

const ensureDir = () => {
  if (!existsSync(CONFIG_DIR)) mkdirSync(CONFIG_DIR, { recursive: true });
};

export const configExists = () => existsSync(CONFIG_PATH);

export const readConfig = () => {
  if (!configExists()) return null;
  return JSON.parse(readFileSync(CONFIG_PATH, 'utf8'));
};

export const writeConfig = (config) => {
  ensureDir();
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
};

export const logCommit = (entry) => {
  ensureDir();
  const logs = existsSync(LOGS_PATH)
    ? JSON.parse(readFileSync(LOGS_PATH, 'utf8'))
    : [];
  logs.unshift({ ...entry, timestamp: new Date().toISOString() });
  writeFileSync(LOGS_PATH, JSON.stringify(logs, null, 2));
};
