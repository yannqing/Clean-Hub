-- Repair only appointments stranded by the old cancellation flow. Never
-- reopen a received/completed appointment or detach a replacement task.
UPDATE appointments AS a
SET status = 'pending', delivery_task_id = NULL,
    accepted_at = NULL, accepted_by = NULL,
    done_at = NULL, done_by = NULL,
    updated_at = now(), version = a.version + 1
WHERE a.deleted_at IS NULL AND a.status = 'accepted'
  AND EXISTS (
    SELECT 1 FROM delivery_tasks AS d
    WHERE d.tenant_id = a.tenant_id AND d.appointment_id = a.id
      AND d.deleted_at IS NULL AND d.status = 'cancelled'
      AND (a.delivery_task_id = d.id OR a.delivery_task_id IS NULL)
  )
  AND NOT EXISTS (
    SELECT 1 FROM delivery_tasks AS active
    WHERE active.tenant_id = a.tenant_id AND active.appointment_id = a.id
      AND active.deleted_at IS NULL AND active.status <> 'cancelled'
  );
