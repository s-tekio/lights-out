import { useReducer, useState } from 'react';
import { DifficultyScreen } from './components/DifficultyScreen';
import { GameScreen } from './components/GameScreen';
import { LeaderboardScreen } from './components/LeaderboardScreen';
import { SettingsScreen } from './components/SettingsScreen';
import { Starfield } from './components/Starfield';
import { TitleScreen } from './components/TitleScreen';
import { useSound } from './sound/useSound';
import { viewReducer } from './viewState';
import './styles.css';

export default function App() {
  const [view, dispatch] = useReducer(viewReducer, { kind: 'title' });
  const [leaderboardRefreshKey, setLeaderboardRefreshKey] = useState(0);
  const { engine, musicEnabled, effectsEnabled, toggleMusic, toggleEffects } = useSound();

  const showBack =
    view.kind === 'difficulty' || view.kind === 'leaderboard' || view.kind === 'settings';

  return (
    <div className="app">
      <Starfield />
      <div className="scanlines" aria-hidden="true" />
      {showBack && (
        <button
          type="button"
          className="back-button"
          onClick={() => dispatch({ type: 'goToTitle' })}
        >
          Back
        </button>
      )}
      <main className="app__main">
        {view.kind === 'title' && (
          <TitleScreen
            onNewGame={() => dispatch({ type: 'goToDifficulty' })}
            onLeaderboard={() => dispatch({ type: 'goToLeaderboard' })}
            onSettings={() => dispatch({ type: 'goToSettings' })}
          />
        )}
        {view.kind === 'difficulty' && (
          <DifficultyScreen
            onSelect={(difficultyId) => dispatch({ type: 'startGame', difficultyId })}
          />
        )}
        {view.kind === 'game' && (
          <GameScreen
            difficultyId={view.difficultyId}
            sound={engine}
            musicEnabled={musicEnabled}
            effectsEnabled={effectsEnabled}
            onToggleMusic={toggleMusic}
            onToggleEffects={toggleEffects}
            onMainMenu={() => dispatch({ type: 'goToTitle' })}
            onScoreSubmitted={() => {
              setLeaderboardRefreshKey((previous) => previous + 1);
              dispatch({ type: 'goToLeaderboard' });
            }}
          />
        )}
        {view.kind === 'leaderboard' && <LeaderboardScreen refreshKey={leaderboardRefreshKey} />}
        {view.kind === 'settings' && (
          <SettingsScreen
            musicEnabled={musicEnabled}
            effectsEnabled={effectsEnabled}
            onToggleMusic={toggleMusic}
            onToggleEffects={toggleEffects}
          />
        )}
      </main>
    </div>
  );
}
