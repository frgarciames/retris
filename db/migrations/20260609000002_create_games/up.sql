create table games (
  id integer primary key autoincrement,
  user_id integer not null references users (id),
  mode text not null,
  seed integer not null,
  lines_goal integer not null,
  duration_ms integer not null,
  lines_cleared integer not null,
  actions text not null,
  created_at integer not null
);

-- Leaderboard reads runs for one mode ordered by fastest time.
create index games_mode_duration_idx on games (mode, duration_ms);
