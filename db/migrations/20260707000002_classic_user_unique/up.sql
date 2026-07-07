-- Keep one classic row per user before enforcing uniqueness.
delete from games
where mode = 'classic'
  and id in (
    select g.id
    from games g
    where g.mode = 'classic'
      and exists (
        select 1
        from games better
        where better.user_id = g.user_id
          and better.mode = 'classic'
          and (
            better.level > g.level
            or (better.level = g.level and better.duration_ms > g.duration_ms)
            or (
              better.level = g.level
              and better.duration_ms = g.duration_ms
              and better.id > g.id
            )
          )
      )
  );

create unique index games_classic_user_idx on games (user_id) where mode = 'classic';
