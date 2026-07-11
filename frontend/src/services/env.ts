import { isTauri as _isTauri } from '@tauri-apps/api/core';

export const isTauri = _isTauri;

export function apiUrl(baseUrl: string, path: string): string {
  if (isTauri()) return `${baseUrl}${path}`;
  return path;
}
