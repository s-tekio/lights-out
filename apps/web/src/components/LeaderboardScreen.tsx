import { Leaderboard } from './Leaderboard';

type LeaderboardScreenProps = {
  readonly refreshKey?: number;
};

export function LeaderboardScreen({ refreshKey }: LeaderboardScreenProps) {
  return (
    <div className="leaderboard-screen">
      <Leaderboard refreshKey={refreshKey} />
    </div>
  );
}
