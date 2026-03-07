-- Enable pg_cron extension for scheduling
create extension if not exists pg_cron with schema extensions;

-- Enable http extension for making HTTP calls
create extension if not exists http with schema extensions;

-- Schedule FPL deadline reminder to run every hour
-- The function will check if current time is within 24-26 hours of deadline
-- This ensures accurate delivery regardless of exact FPL schedule changes
select cron.schedule(
  'fpl-deadline-reminder',
  '0 * * * *',
  $$
  select http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/send-deadline-reminder',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', current_setting('app.supabase_anon_key'),
      'Authorization', 'Bearer ' || current_setting('app.supabase_anon_key')
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Schedule FPL data refresh to run every hour at :30 past the hour
-- Keeps gameweek deadlines and player data up to date
select cron.schedule(
  'fpl-data-refresh',
  '30 * * * *',
  $$
  select http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/refresh-fpl-data',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', current_setting('app.supabase_anon_key'),
      'Authorization', 'Bearer ' || current_setting('app.supabase_anon_key')
    ),
    body := '{}'::jsonb
  );
  $$
);
