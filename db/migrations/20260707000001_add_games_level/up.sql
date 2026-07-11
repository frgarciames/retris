alter table games add column level integer not null default 0;

create index games_mode_level_duration_idx on games (mode, level, duration_ms);
