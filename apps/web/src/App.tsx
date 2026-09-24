import { Game } from './components/Game';
import './styles.css';

export default function App() {
  return (
    <div className="app">
      <header className="app__header">
        <h1>Lights Out</h1>
      </header>
      <main className="app__main">
        <Game />
      </main>
      <aside className="app__leaderboard" aria-label="Leaderboard">
        <h2>Leaderboard</h2>
        <p>Leaderboard data will appear here in a future update.</p>
      </aside>
    </div>
  );
}
