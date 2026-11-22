import { accessToken, freshAccessToken } from './google-auth';

/** The one file Zort keeps in the user's Drive, in its hidden app folder. */
const FILE_NAME = 'zort-backup.json';
const API = 'https://www.googleapis.com/drive/v3';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3';
const FIELDS = 'id,modifiedTime,appProperties';

export type RemoteBackup = {
  id: string;
  modifiedTime: string;
  /**
   * The DATABASE_VERSION of the app that wrote it, kept in the file's metadata so an older app
   * can tell, without downloading it, that it mustn't replace it. Null for the first builds'.
   */
  schema: number | null;
};

type DriveFile = { id: string; modifiedTime: string; appProperties?: Record<string, string> };

const toRemote = (file: DriveFile): RemoteBackup => ({
  id: file.id,
  modifiedTime: file.modifiedTime,
  schema: file.appProperties?.schema ? Number(file.appProperties.schema) : null,
});

export class DriveError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Calls Drive as the signed-in user; a rejected token is renewed once. */
async function drive(url: string, init: RequestInit = {}): Promise<Response> {
  const send = (token: string) =>
    fetch(url, { ...init, headers: { ...init.headers, Authorization: `Bearer ${token}` } });
  let token = await accessToken();
  let response = await send(token);
  if (response.status === 401) {
    token = await freshAccessToken(token);
    response = await send(token);
  }
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new DriveError(response.status, `Google Drive: ${response.status} ${detail.slice(0, 200)}`);
  }
  return response;
}

export async function findBackup(): Promise<RemoteBackup | null> {
  const query = new URLSearchParams({
    spaces: 'appDataFolder',
    q: `name = '${FILE_NAME}' and trashed = false`,
    fields: `files(${FIELDS})`,
    orderBy: 'modifiedTime desc',
    pageSize: '1',
  });
  const { files } = (await (await drive(`${API}/files?${query}`)).json()) as { files: DriveFile[] };
  return files[0] ? toRemote(files[0]) : null;
}

export async function downloadBackup(id: string): Promise<string> {
  return (await drive(`${API}/files/${id}?alt=media`)).text();
}

/** Metadata and contents in one request, for creating the file and for replacing it. */
function multipart(metadata: object, contents: string) {
  const boundary = `zort-${Date.now()}`;
  return {
    headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
    body:
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}` +
      `\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n${contents}\r\n--${boundary}--`,
  };
}

/** Replaces the backup (or creates it) and records which schema wrote it. */
export async function uploadBackup(contents: string, schema: number, id: string | null): Promise<RemoteBackup> {
  const appProperties = { schema: String(schema) };
  if (id) {
    try {
      const response = await drive(`${UPLOAD}/files/${id}?uploadType=multipart&fields=${FIELDS}`, {
        method: 'PATCH',
        ...multipart({ appProperties }, contents),
      });
      return toRemote((await response.json()) as DriveFile);
    } catch (error) {
      // Deleted in the meantime (from another device, or Drive's "Manage apps"): make a new one
      if (!(error instanceof DriveError && error.status === 404)) throw error;
    }
  }
  const response = await drive(`${UPLOAD}/files?uploadType=multipart&fields=${FIELDS}`, {
    method: 'POST',
    ...multipart({ name: FILE_NAME, parents: ['appDataFolder'], mimeType: 'application/json', appProperties }, contents),
  });
  return toRemote((await response.json()) as DriveFile);
}

export async function deleteBackup(id: string): Promise<void> {
  try {
    await drive(`${API}/files/${id}`, { method: 'DELETE' });
  } catch (error) {
    if (!(error instanceof DriveError && error.status === 404)) throw error;
  }
}
