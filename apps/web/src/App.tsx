import { useRef, useState } from 'react';
import { Game } from './components/Game';
import { HelpDialog } from './components/HelpDialog';
import { Leaderboard } from './components/Leaderboard';
import './styles.css';

export default function App() {
  const [leaderboardRefreshKey, setLeaderboardRefreshKey] = useState(0);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const helpTriggerRef = useRef<HTMLButtonElement>(null);

  return (
    <div className="app">
      <header className="app__header">
        <h1>Lights Out</h1>
        <button
          ref={helpTriggerRef}
          type="button"
          aria-haspopup="dialog"
          aria-expanded={isHelpOpen}
          aria-controls={isHelpOpen ? 'help-dialog' : undefined}
          onClick={() => setIsHelpOpen(true)}
        >
          Help
        </button>
      </header>
      <main className="app__main">
        <Game onScoreSubmitted={() => setLeaderboardRefreshKey((previous) => previous + 1)} />
      </main>
      <aside className="app__leaderboard" aria-label="Leaderboard">
        <Leaderboard refreshKey={leaderboardRefreshKey} />
      </aside>
      <HelpDialog
        isOpen={isHelpOpen}
        onClose={() => setIsHelpOpen(false)}
        triggerRef={helpTriggerRef}
      />
    </div>
  );
}
