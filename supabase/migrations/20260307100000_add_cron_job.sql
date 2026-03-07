-- Enable pg_cron extension for scheduling
create extension if not exists pg_cron with schema extensions;

-- Enable http extension for making HTTP calls
create extension if not exists http with schema extensions;

-- Schedule FPL deadline reminder
-- Runs every Friday at 11:00 UTC (typical FPL deadline is Friday 11:00 GMT)
-- This timing gives reminders to users before the deadline
select cron.schedule(
  'fpl-deadline-reminder',
  '0 11 * * 5',
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
