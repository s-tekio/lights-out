import { Modal } from './Modal';

type GameMenuProps = {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly triggerRef: React.RefObject<HTMLButtonElement | null>;
  readonly musicEnabled: boolean;
  readonly effectsEnabled: boolean;
  readonly onToggleMusic: () => void;
  readonly onToggleEffects: () => void;
  readonly onResetGame: () => void;
  readonly onHowToPlay: () => void;
  readonly onMainMenu: () => void;
};

export function GameMenu({
  isOpen,
  onClose,
  triggerRef,
  musicEnabled,
  effectsEnabled,
  onToggleMusic,
  onToggleEffects,
  onResetGame,
  onHowToPlay,
  onMainMenu,
}: GameMenuProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      triggerRef={triggerRef}
      dialogId="game-menu"
      titleId="game-menu-title"
    >
      <h2 id="game-menu-title">Menu</h2>
      <nav aria-label="Game menu" className="game-menu">
        <button
          type="button"
          className="game-menu__entry"
          onClick={() => {
            onResetGame();
          }}
        >
          Reset Game
        </button>
        <button
          type="button"
          className="game-menu__entry toggle"
          onClick={onToggleMusic}
          aria-pressed={musicEnabled}
        >
          <span className="toggle__label">Music</span>
          <span className="toggle__state" aria-hidden="true">
            {musicEnabled ? 'On' : 'Off'}
          </span>
        </button>
        <button
          type="button"
          className="game-menu__entry toggle"
          onClick={onToggleEffects}
          aria-pressed={effectsEnabled}
        >
          <span className="toggle__label">Effects</span>
          <span className="toggle__state" aria-hidden="true">
            {effectsEnabled ? 'On' : 'Off'}
          </span>
        </button>
        <button
          type="button"
          className="game-menu__entry"
          onClick={() => {
            onClose();
            onHowToPlay();
          }}
        >
          How to play
        </button>
        <button
          type="button"
          className="game-menu__entry game-menu__entry--emphasis"
          onClick={() => {
            onMainMenu();
          }}
        >
          Main menu
        </button>
      </nav>
    </Modal>
  );
}
