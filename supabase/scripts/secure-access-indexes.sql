-- Proposed indexes for secure-access I/O hotspots in:
-- src/lib/secure-access/run-next-secure-document-access.ts
--
-- Apply in low-traffic windows first, then verify with EXPLAIN.
-- If table size is large and lock sensitivity is high, prefer CREATE INDEX CONCURRENTLY
-- (must run outside transaction blocks).

-- 1) access_logs: brute-force + hourly success count queries
create index if not exists access_logs_user_action_status_created_at_idx
on access_logs (user_id, action, status, created_at);

-- 2) access_logs: IP/hourly limit query
create index if not exists access_logs_ip_action_created_at_idx
on access_logs (ip_address, action, created_at);

-- 3) permissions: user/document gate lookup
create index if not exists permissions_user_document_idx
on permissions (user_id, document_id);

-- 4) device_logs: list device ids for a user
create index if not exists device_logs_user_idx
on device_logs (user_id);

-- Note: ensure unique/composite key exists for upsert onConflict("user_id,device_id")
-- e.g.
-- create unique index if not exists device_logs_user_device_uniq
-- on device_logs (user_id, device_id);

-- 5) active_sessions: latest session by user
create index if not exists active_sessions_user_created_at_desc_idx
on active_sessions (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Validation samples (replace bind values with real data)
-- ---------------------------------------------------------------------------

-- Brute-force blocked count (10 min)
explain (analyze, buffers)
select id
from access_logs
where user_id = '00000000-0000-0000-0000-000000000000'
  and action = 'secure_pdf'
  and status = 'blocked'
  and created_at >= now() - interval '10 minutes';

-- IP/hour limit count (1 hour)
explain (analyze, buffers)
select id
from access_logs
where action = 'secure_pdf'
  and ip_address = '127.0.0.1'
  and created_at >= now() - interval '1 hour';

-- Hourly success count
explain (analyze, buffers)
select id
from access_logs
where user_id = '00000000-0000-0000-0000-000000000000'
  and action = 'secure_pdf'
  and status = 'success'
  and created_at >= now() - interval '1 hour';

-- High-frequency distinct docs (10 min)
explain (analyze, buffers)
select document_id
from access_logs
where user_id = '00000000-0000-0000-0000-000000000000'
  and action = 'secure_pdf'
  and status = 'success'
  and created_at >= now() - interval '10 minutes';

-- Permission lookup
explain (analyze, buffers)
select id, expires_at
from permissions
where user_id = '00000000-0000-0000-0000-000000000000'
  and document_id = '00000000-0000-0000-0000-000000000000'
limit 1;

-- Device list by user
explain (analyze, buffers)
select device_id
from device_logs
where user_id = '00000000-0000-0000-0000-000000000000';

-- Latest active session
explain (analyze, buffers)
select device_id
from active_sessions
where user_id = '00000000-0000-0000-0000-000000000000'
order by created_at desc
limit 1;
