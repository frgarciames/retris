create table users (
  id integer primary key autoincrement,
  username text not null unique,
  password_hash text not null,
  created_at integer not null
);

create unique index users_username_idx on users (username);
