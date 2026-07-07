alter table users add column email text;
create unique index users_email_idx on users (email);
