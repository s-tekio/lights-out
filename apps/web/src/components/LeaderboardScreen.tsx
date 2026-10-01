import { Leaderboard } from './Leaderboard';

type LeaderboardScreenProps = {
  readonly refreshKey?: number;
};

export function LeaderboardScreen({ refreshKey }: LeaderboardScreenProps) {
  return (
    <div className="leaderboard-screen">
      <h2 className="screen-title">Leaderboard</h2>
      <Leaderboard refreshKey={refreshKey} />
    </div>
  );
}
