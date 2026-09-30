import { useRef, useState } from 'react';
import type { DifficultyId } from '../game/difficulty';
import type { SoundEngine } from '../sound/engine';
import { Game } from './Game';
import { GameMenu } from './GameMenu';
import { HelpDialog } from './HelpDialog';

type GameScreenProps = {
  readonly difficultyId: DifficultyId;
  readonly sound: SoundEngine;
  readonly musicEnabled: boolean;
  readonly effectsEnabled: boolean;
  readonly onToggleMusic: () => void;
  readonly onToggleEffects: () => void;
  readonly onMainMenu: () => void;
  readonly onScoreSubmitted?: () => void;
};

export function GameScreen({
  difficultyId,
  sound,
  musicEnabled,
  effectsEnabled,
  onToggleMusic,
  onToggleEffects,
  onMainMenu,
  onScoreSubmitted,
}: GameScreenProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const menuTriggerRef = useRef<HTMLButtonElement>(null);

  const handleResetGame = () => {
    setResetKey((previous) => previous + 1);
    setIsMenuOpen(false);
  };

  const handleHowToPlay = () => {
    setIsHelpOpen(true);
  };

  const handleMainMenu = () => {
    setIsMenuOpen(false);
    onMainMenu();
  };

  return (
    <div className="game-screen">
      <button
        ref={menuTriggerRef}
        type="button"
        className="game-screen__menu-button"
        aria-label="Open game menu"
        aria-haspopup="dialog"
        aria-expanded={isMenuOpen}
        aria-controls={isMenuOpen ? 'game-menu' : undefined}
        onClick={() => setIsMenuOpen(true)}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <line x1="4" y1="6" x2="20" y2="6" />
          <line x1="4" y1="12" x2="20" y2="12" />
          <line x1="4" y1="18" x2="20" y2="18" />
        </svg>
      </button>
      <Game
        key={resetKey}
        difficultyId={difficultyId}
        sound={sound}
        onScoreSubmitted={onScoreSubmitted}
        onMainMenu={onMainMenu}
      />
      <GameMenu
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        triggerRef={menuTriggerRef}
        musicEnabled={musicEnabled}
        effectsEnabled={effectsEnabled}
        onToggleMusic={onToggleMusic}
        onToggleEffects={onToggleEffects}
        onResetGame={handleResetGame}
        onHowToPlay={handleHowToPlay}
        onMainMenu={handleMainMenu}
      />
      <HelpDialog
        isOpen={isHelpOpen}
        onClose={() => setIsHelpOpen(false)}
        triggerRef={menuTriggerRef}
      />
    </div>
  );
}
