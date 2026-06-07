-- Auto-detected overtime is approved immediately; clear legacy pending rows.
UPDATE overtime_requests
SET status = 'approved'
WHERE source = 'auto' AND status = 'pending';
