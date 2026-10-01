type StatusPanelProps = {
  readonly moves: number;
  readonly elapsedMs: number;
  readonly menuTriggerRef?: React.RefObject<HTMLButtonElement | null>;
  readonly isMenuOpen?: boolean;
  readonly onOpenMenu?: () => void;
};

function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export function StatusPanel({
  moves,
  elapsedMs,
  menuTriggerRef,
  isMenuOpen,
  onOpenMenu,
}: StatusPanelProps) {
  return (
    <section className="status" aria-label="Game status">
      <div className="status__row">
        <p className="status__metric">Moves: {moves}</p>
        <p className="status__metric">Time: {formatElapsed(elapsedMs)}</p>
        {onOpenMenu !== undefined && (
          <button
            ref={menuTriggerRef}
            type="button"
            className="status__menu-button"
            aria-label="Open game menu"
            aria-haspopup="dialog"
            aria-expanded={isMenuOpen}
            aria-controls={isMenuOpen ? 'game-menu' : undefined}
            onClick={onOpenMenu}
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
        )}
      </div>
    </section>
  );
}
