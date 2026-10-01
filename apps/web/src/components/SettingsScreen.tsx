type SettingsScreenProps = {
  readonly musicEnabled: boolean;
  readonly effectsEnabled: boolean;
  readonly onToggleMusic: () => void;
  readonly onToggleEffects: () => void;
};

export function SettingsScreen({
  musicEnabled,
  effectsEnabled,
  onToggleMusic,
  onToggleEffects,
}: SettingsScreenProps) {
  return (
    <div className="settings-screen">
      <h2 className="screen-title">Settings</h2>
      <div className="settings__list">
        <button
          type="button"
          className="toggle"
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
          className="toggle"
          onClick={onToggleEffects}
          aria-pressed={effectsEnabled}
        >
          <span className="toggle__label">Effects</span>
          <span className="toggle__state" aria-hidden="true">
            {effectsEnabled ? 'On' : 'Off'}
          </span>
        </button>
      </div>
    </div>
  );
}
