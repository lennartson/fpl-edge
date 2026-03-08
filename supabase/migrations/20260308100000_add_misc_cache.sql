create table misc_cache (
  key        text primary key,
  data       jsonb,
  cached_at  timestamp,
  expires_at timestamp
);

alter table misc_cache enable row level security;

do $$ begin
  create policy "public read misc_cache" on misc_cache for select using (true);
exception when duplicate_object then null; end $$;
