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
      <Game
        key={resetKey}
        difficultyId={difficultyId}
        sound={sound}
        onScoreSubmitted={onScoreSubmitted}
        onMainMenu={onMainMenu}
        menuTriggerRef={menuTriggerRef}
        isMenuOpen={isMenuOpen}
        onOpenMenu={() => setIsMenuOpen(true)}
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
