import { get, set, del } from 'idb-keyval';

export async function saveFile(file: File): Promise<string> {
  const fileId = crypto.randomUUID();
  await set(`pdf-${fileId}`, file);
  return fileId;
}

export async function getFile(fileId: string): Promise<File | undefined> {
  return await get(`pdf-${fileId}`);
}

export async function deleteFile(fileId: string): Promise<void> {
  await del(`pdf-${fileId}`);
}
