import { randomUUID } from 'expo-crypto';
import { useSQLiteContext } from 'expo-sqlite';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { useDataChanges } from './data-events';
import { setFavorite as setRowFavorite } from './db';
import { deleteLink, insertLink, listLinks, updateLink, type Link } from './links-db';

/** `url` already normalized (see normalizeUrl). */
export type LinkInput = { url: string; title: string };

type LinksContextValue = {
  links: Link[];
  loaded: boolean;
  createLink(input: LinkInput): Promise<Link>;
  editLink(id: string, input: LinkInput): Promise<void>;
  setFavorite(id: string, favorite: boolean): Promise<void>;
  removeLink(id: string): Promise<void>;
};

const LinksContext = createContext<LinksContextValue | null>(null);

/** The saved links; at the root so the home screen can show how many there are. */
export function LinksProvider({ children }: { children: ReactNode }) {
  const db = useSQLiteContext();
  const [links, setLinks] = useState<Link[]>([]);
  const [loaded, setLoaded] = useState(false);
  const linksRef = useRef(links);

  const commit = useCallback((next: Link[]) => {
    linksRef.current = next;
    setLinks(next);
  }, []);

  // Another copy of this provider (the widget's quick-add window, or the app) changed the links
  const announce = useDataChanges('links', () => {
    listLinks(db)
      .then(commit)
      .catch((error) => console.error('Could not reload links', error));
  });

  useEffect(() => {
    let cancelled = false;
    listLinks(db)
      .then((rows) => {
        if (!cancelled) commit(rows);
      })
      .catch((error) => console.error('Could not load links', error))
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [db, commit]);

  const createLink = useCallback(
    async (input: LinkInput) => {
      const now = Date.now();
      const link: Link = {
        id: randomUUID(),
        url: input.url,
        title: input.title.trim(),
        favorite: false,
        createdAt: now,
        updatedAt: now,
      };
      await insertLink(db, link);
      commit([link, ...linksRef.current]);
      announce();
      return link;
    },
    [db, commit, announce],
  );

  const editLink = useCallback(
    async (id: string, input: LinkInput) => {
      const existing = linksRef.current.find((link) => link.id === id);
      if (!existing) throw new Error(`Link ${id} not found`);
      const link: Link = { ...existing, url: input.url, title: input.title.trim(), updatedAt: Date.now() };
      await updateLink(db, link);
      commit(linksRef.current.map((item) => (item.id === id ? link : item)));
      announce();
    },
    [db, commit, announce],
  );

  const setFavorite = useCallback(
    async (id: string, favorite: boolean) => {
      await setRowFavorite(db, 'links', id, favorite);
      commit(linksRef.current.map((link) => (link.id === id ? { ...link, favorite } : link)));
      announce();
    },
    [db, commit, announce],
  );

  const removeLink = useCallback(
    async (id: string) => {
      await deleteLink(db, id);
      commit(linksRef.current.filter((link) => link.id !== id));
      announce();
    },
    [db, commit, announce],
  );

  const value = useMemo(
    () => ({ links, loaded, createLink, editLink, setFavorite, removeLink }),
    [links, loaded, createLink, editLink, setFavorite, removeLink],
  );

  return <LinksContext.Provider value={value}>{children}</LinksContext.Provider>;
}

export function useLinks(): LinksContextValue {
  const value = useContext(LinksContext);
  if (!value) throw new Error('useLinks must be used inside LinksProvider');
  return value;
}
