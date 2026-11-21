// Content shared by the game, the client UI and the server: modes, emotes,
// quick chat, cosmetics and coin rewards.
export const MODES = [
  { id: 'heist', name: 'Co-op Heist', min: 1, max: 4, blurb: 'Work together: grab the snacks and get everyone back without waking a soul.' },
  { id: 'hideseek', name: 'Hide & Seek', min: 2, max: 4, blurb: 'One player is the Night Guard with a flashlight. Everyone else hides.' },
  { id: 'race', name: 'Fridge Race', min: 1, max: 4, blurb: 'First to the fridge wins. Wake someone or get spotted and you’re sent back.' },
];
export const MODE_BY_ID = Object.fromEntries(MODES.map((m) => [m.id, m]));

export const EMOTES = [
  { id: 'shh', name: 'The Shh', key: '1' },
  { id: 'wave', name: 'Wave', key: '2' },
  { id: 'dance', name: 'Snack dance (noisy!)', key: '3' },
  { id: 'shrug', name: 'Shrug', key: '4' },
  { id: 'thumbs', name: 'Thumbs up', key: '5' },
];
export const EMOTE_IDS = new Set(EMOTES.map((e) => e.id));

// The only things players can "say" to each other. No free typing, ever.
export const QUICK_CHAT = ['Hide!', 'Go go go!', 'Shhh!', 'Over here!', 'Wait!', 'Got a snack!', 'Nice one!', 'Help!'];

export const OUTFITS = [
  { id: 'classic', name: 'Classic stripes', price: 0, shirt: '#5a3826', bands: ['#f1e9dd', '#ef9a85'], pants: '#2a3247' },
  { id: 'pajamas', name: 'Starry pajamas', price: 120, shirt: '#2c3a7a', bands: ['#2c3a7a', '#2c3a7a'], pants: '#2c3a7a', pattern: 'stars' },
  { id: 'hoodie', name: 'Mint hoodie', price: 180, shirt: '#3c9a85', bands: ['#2f7d6c', '#3c9a85'], pants: '#33363f', hood: true },
  { id: 'chef', name: 'Snack chef', price: 250, shirt: '#f2efe8', bands: ['#e2b65a', '#f2efe8'], pants: '#3b3f52', hat: true },
  { id: 'ninja', name: 'Midnight ninja', price: 300, shirt: '#1c1d26', bands: ['#c94b3a', '#1c1d26'], pants: '#1c1d26', mask: true },
  { id: 'dino', name: 'Dino onesie', price: 400, shirt: '#5aa04f', bands: ['#f2d27a', '#5aa04f'], pants: '#5aa04f', spikes: true },
];
export const HAIR_COLORS = [
  { id: 'black', name: 'Midnight black', color: '#141012', price: 0 },
  { id: 'brown', name: 'Cocoa brown', color: '#4a2c1c', price: 50 },
  { id: 'ginger', name: 'Ginger', color: '#b5552b', price: 80 },
  { id: 'blonde', name: 'Honey blonde', color: '#d8b56a', price: 80 },
  { id: 'blue', name: 'Night blue', color: '#3b6fe0', price: 150 },
  { id: 'pink', name: 'Bubblegum', color: '#f27fb2', price: 150 },
  { id: 'green', name: 'Lime', color: '#4fbf6a', price: 150 },
  { id: 'silver', name: 'Moon silver', color: '#c9cdd6', price: 200 },
];
export const OUTFIT_BY_ID = Object.fromEntries(OUTFITS.map((o) => [o.id, o]));
export const HAIR_BY_ID = Object.fromEntries(HAIR_COLORS.map((h) => [h.id, h]));
export const DEFAULT_LOOK = { outfit: 'classic', hair: 'black' };
export const FREE_ITEMS = ['outfit:classic', 'hair:black'];

export function shopItem(kind, id) {
  return kind === 'outfit' ? OUTFIT_BY_ID[id] : kind === 'hair' ? HAIR_BY_ID[id] : null;
}

export function cleanLook(look) {
  return {
    outfit: OUTFIT_BY_ID[look?.outfit] ? look.outfit : DEFAULT_LOOK.outfit,
    hair: HAIR_BY_ID[look?.hair] ? look.hair : DEFAULT_LOOK.hair,
  };
}

// Did this player win the round?
export function didWin(outcome, playerId) {
  if (!outcome) return false;
  if (outcome.mode === 'race') return outcome.winnerId === playerId;
  if (outcome.mode === 'hideseek') {
    const guard = outcome.guardId === playerId;
    return outcome.result === (guard ? 'guard' : 'hiders');
  }
  return outcome.result === 'escaped';
}

// Coins for one player after a round. Kept small and predictable.
export function coinsFor(outcome, playerId) {
  if (!outcome) return 0;
  const won = didWin(outcome, playerId);
  if (outcome.mode === 'race') return won ? 40 : 10;
  if (outcome.mode === 'hideseek') return won ? 35 : 10;
  const snacks = Math.max(0, Math.min(20, outcome.snacks | 0));
  const stars = Math.max(0, Math.min(3, outcome.stars | 0));
  return won ? snacks * 10 + stars * 15 : snacks * 2;
}
