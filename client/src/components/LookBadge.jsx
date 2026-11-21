import { HAIR_BY_ID, OUTFIT_BY_ID } from '@shared/catalog.js';

// A tiny flat portrait of a hero's outfit and hair, for menus and lobbies.
export default function LookBadge({ look, size = 40 }) {
  const outfit = OUTFIT_BY_ID[look?.outfit] || OUTFIT_BY_ID.classic;
  const hair = (HAIR_BY_ID[look?.hair] || HAIR_BY_ID.black).color;
  return (
    <svg className="look-badge" width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
      <rect x="9" y="22" width="22" height="18" rx="4" fill={outfit.shirt} />
      <rect x="9" y="27" width="22" height="3" fill={outfit.bands[0]} />
      <rect x="9" y="30" width="22" height="4" fill={outfit.bands[1]} />
      <circle cx="20" cy="15" r="9" fill="#b97c5a" />
      <path d="M10.5 14 Q11 5 20 5 Q29 5 29.5 14 L26 11 L23 13 L20 10.5 L17 13 L14 11 Z" fill={hair} />
      <rect x="15" y="15" width="3" height="2" rx="1" fill="#1a0f0a" />
      <rect x="22" y="15" width="3" height="2" rx="1" fill="#1a0f0a" />
    </svg>
  );
}
