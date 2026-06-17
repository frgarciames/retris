create table versus_games (
  id integer primary key autoincrement,
  winner_user_id integer references users (id),
  loser_user_id integer references users (id),
  winner_name text not null,
  loser_name text not null,
  seed integer not null,
  winner_actions text not null,
  winner_garbage text not null,
  winner_lines integer not null,
  loser_actions text not null,
  loser_garbage text not null,
  loser_lines integer not null,
  created_at integer not null
);

-- Leaderboard scans every match newest-first to tally per-user wins.
create index versus_games_created_idx on versus_games (created_at);
