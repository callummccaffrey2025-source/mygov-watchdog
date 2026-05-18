-- Verity Analytics Dashboard
-- Run weekly in Supabase SQL Editor (Dashboard > SQL Editor > New Query)
-- No code changes needed -- lib/analytics.ts already fires events to analytics_events table

-- 1. Weekly Active Users
SELECT COUNT(DISTINCT COALESCE(user_id::text, device_id)) as weekly_active_users
FROM analytics_events
WHERE created_at > now() - interval '7 days';

-- 2. Screen Views (which screens get used?)
SELECT event_data->>'screen' as screen, COUNT(*) as views
FROM analytics_events
WHERE event_name = 'screen_view'
  AND created_at > now() - interval '7 days'
GROUP BY 1 ORDER BY 2 DESC LIMIT 15;

-- 3. Feature Adoption (which features get used?)
SELECT event_name, COUNT(*) as events,
       COUNT(DISTINCT COALESCE(user_id::text, device_id)) as unique_users
FROM analytics_events
WHERE event_name != 'screen_view'
  AND created_at > now() - interval '7 days'
GROUP BY 1 ORDER BY 2 DESC;

-- 4. Daily Active Users (30-day trend)
SELECT DATE(created_at) as day,
       COUNT(DISTINCT COALESCE(user_id::text, device_id)) as dau
FROM analytics_events
WHERE created_at > now() - interval '30 days'
GROUP BY 1 ORDER BY 1;

-- 5. Share Card Usage
SELECT event_data->>'card_type' as card_type, COUNT(*) as shares
FROM analytics_events
WHERE event_name = 'share_card'
  AND created_at > now() - interval '30 days'
GROUP BY 1 ORDER BY 2 DESC;

-- 6. Poll Engagement
SELECT event_name, COUNT(*) as events
FROM analytics_events
WHERE event_name LIKE '%poll%'
  AND created_at > now() - interval '30 days'
GROUP BY 1 ORDER BY 2 DESC;

-- 7. Electorate Distribution (where are users?)
SELECT event_data->>'electorate' as electorate, COUNT(DISTINCT COALESCE(user_id::text, device_id)) as users
FROM analytics_events
WHERE event_data->>'electorate' IS NOT NULL
  AND created_at > now() - interval '30 days'
GROUP BY 1 ORDER BY 2 DESC LIMIT 20;
