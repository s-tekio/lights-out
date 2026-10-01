type TitleScreenProps = {
  readonly onNewGame: () => void;
  readonly onLeaderboard: () => void;
  readonly onSettings: () => void;
  readonly onHowToPlay: () => void;
  readonly helpTriggerRef: React.RefObject<HTMLButtonElement | null>;
};

export function TitleScreen({
  onNewGame,
  onLeaderboard,
  onSettings,
  onHowToPlay,
  helpTriggerRef,
}: TitleScreenProps) {
  return (
    <div className="title-screen">
      <h1 className="game-title" data-text="Lights Out">
        Lights Out
      </h1>
      <nav aria-label="Main menu" className="menu">
        <button type="button" className="menu__entry" onClick={onNewGame}>
          New Game
        </button>
        <button type="button" className="menu__entry" onClick={onLeaderboard}>
          Leaderboard
        </button>
        <button type="button" className="menu__entry" onClick={onSettings}>
          Settings
        </button>
        <button ref={helpTriggerRef} type="button" className="menu__entry" onClick={onHowToPlay}>
          How to play
        </button>
      </nav>
    </div>
  );
}
