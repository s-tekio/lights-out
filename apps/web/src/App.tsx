import { useState } from 'react';
import { Game } from './components/Game';
import { Leaderboard } from './components/Leaderboard';
import './styles.css';

export default function App() {
  const [leaderboardRefreshKey, setLeaderboardRefreshKey] = useState(0);

  return (
    <div className="app">
      <header className="app__header">
        <h1>Lights Out</h1>
      </header>
      <main className="app__main">
        <Game onScoreSubmitted={() => setLeaderboardRefreshKey((previous) => previous + 1)} />
      </main>
      <aside className="app__leaderboard" aria-label="Leaderboard">
        <Leaderboard refreshKey={leaderboardRefreshKey} />
      </aside>
    </div>
  );
}
