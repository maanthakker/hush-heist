import { useEffect, useRef } from 'react';
import { Game } from '../game/Game.js';
import { audio } from '../audio/AudioEngine.js';

// Mounts the three.js game once and hands the instance back to React.
export default function GameCanvas({ onReady, onHud, onEnd }) {
  const hostRef = useRef(null);
  const callbacks = useRef({ onHud, onEnd });
  callbacks.current = { onHud, onEnd };

  useEffect(() => {
    let game;
    try {
      game = new Game(hostRef.current, {
        onHud: (h) => callbacks.current.onHud?.(h),
        onEnd: (r) => callbacks.current.onEnd?.(r),
      });
    } catch (err) {
      console.error(err);
      onReady?.(null, err);
      return undefined;
    }
    onReady?.(game, null);
    // Handy while developing: poke the running game from the browser console.
    if (import.meta.env.DEV) {
      window.__hushGame = game;
      window.__hushAudio = audio;
    }
    return () => game.dispose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={hostRef} className="game-host" />;
}
