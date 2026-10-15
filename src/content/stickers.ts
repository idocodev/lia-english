// Sticker collection, earned one per finished round. Emoji for the POC; custom art later.
export const STICKERS = ['🦄', '🌈', '🍓', '🦋', '🌸', '🐰', '🐱', '🦉', '🧁', '🐣', '🌻', '🍉', '🐼', '🦊', '🍭', '💖', '🐬', '🌟']

export function nextSticker(owned: string[]): string {
  const left = STICKERS.filter((s) => !owned.includes(s))
  const from = left.length ? left : STICKERS
  return from[Math.floor(Math.random() * from.length)]
}
