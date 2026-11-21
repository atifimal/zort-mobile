import type { SQLiteDatabase } from 'expo-sqlite';

export type Link = {
  id: string;
  url: string;
  /** Optional; the list shows the address when it's empty. */
  title: string;
  createdAt: number;
  updatedAt: number;
};

type LinkRow = { id: string; url: string; title: string; created_at: number; updated_at: number };

const fromRow = (row: LinkRow): Link => ({
  id: row.id,
  url: row.url,
  title: row.title,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export async function listLinks(db: SQLiteDatabase): Promise<Link[]> {
  const rows = await db.getAllAsync<LinkRow>('SELECT * FROM links ORDER BY created_at DESC');
  return rows.map(fromRow);
}

export async function insertLink(db: SQLiteDatabase, link: Link): Promise<void> {
  await db.runAsync(
    'INSERT INTO links (id, url, title, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
    link.id,
    link.url,
    link.title,
    link.createdAt,
    link.updatedAt,
  );
}

export async function updateLink(db: SQLiteDatabase, link: Link): Promise<void> {
  await db.runAsync(
    'UPDATE links SET url = ?, title = ?, updated_at = ? WHERE id = ?',
    link.url,
    link.title,
    link.updatedAt,
    link.id,
  );
}

export async function deleteLink(db: SQLiteDatabase, id: string): Promise<void> {
  await db.runAsync('DELETE FROM links WHERE id = ?', id);
}
