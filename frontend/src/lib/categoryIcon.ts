const KNOWN: Record<string, string> = {
  laundry: '🧺',
  dishes: '🍽️',
  cleaning: '🧽',
  household: '🏠',
  hair: '💆',
  care: '🪥',
  health: '🌿',
  beauty: '💄',
  kids: '🧸',
  food: '🍯',
  fragrance: '🌸',
  pest: '🦟',
  body: '🧴',
  face: '✨',
  oral: '🪥',
  wellness: '🩹',
}

/** Category icons are either a known key from the seed catalog or an emoji typed in the admin panel. */
export function categoryIcon(icon: string | null | undefined): string {
  if (!icon) return '🌿'
  const known = KNOWN[icon.trim().toLowerCase()]
  if (known) return known
  return /^[\p{Letter}\p{Number}\s_-]+$/u.test(icon) ? '🌿' : icon
}
