// Mute / unmute your microphone for party voice chat.
// state: 'off' (voice not started yet), 'muted', or 'live'.
export default function MicButton({ state, onToggle, className = '' }) {
  const live = state === 'live';
  const label = state === 'off' ? 'Turn on your mic' : live ? 'Mute your mic (M)' : 'Unmute your mic (M)';
  return (
    <button
      type="button"
      className={`mic-btn is-${state} ${className}`}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onToggle}
      aria-label={label}
      aria-pressed={live}
      title={label}
    >
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
        <rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor" />
        <path d="M6 11a6 6 0 0 0 12 0M12 17v4M9 21h6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        {!live && <path d="M4 4l16 16" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />}
      </svg>
    </button>
  );
}
