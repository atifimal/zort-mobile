import { LayoutAnimation } from 'react-native';

/** Favorites first; otherwise the list keeps its order (newest, or last edited, first). */
export function favoritesFirst<T extends { favorite: boolean }>(items: readonly T[]): T[] {
  return [...items.filter((item) => item.favorite), ...items.filter((item) => !item.favorite)];
}

/** Call right before a favorite changes, so the card slides to its new place instead of jumping. */
export function animateReorder() {
  LayoutAnimation.configureNext(LayoutAnimation.create(220, 'easeInEaseOut', 'opacity'));
}
