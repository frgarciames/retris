create table password_reset_tokens (
  id integer primary key autoincrement,
  user_id integer not null references users(id) on delete cascade,
  token_hash text not null unique,
  expires_at integer not null,
  created_at integer not null
);
create index password_reset_tokens_user_id_idx on password_reset_tokens (user_id);
