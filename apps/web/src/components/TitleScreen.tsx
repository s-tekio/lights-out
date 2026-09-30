type TitleScreenProps = {
  readonly onNewGame: () => void;
  readonly onLeaderboard: () => void;
  readonly onSettings: () => void;
};

export function TitleScreen({ onNewGame, onLeaderboard, onSettings }: TitleScreenProps) {
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
      </nav>
    </div>
  );
}
