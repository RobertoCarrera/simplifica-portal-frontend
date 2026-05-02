-- Migration: tighten_client_portal_users_nullability
-- Problem: client_portal_users.client_id can be NULL, which allowed a fallback in
--          client-portal-bff authenticate() to query clients by auth_user_id WITHOUT
--          filtering by company_id. A portal user with NULL client_id could potentially
--          see bookings/invoices from any company the user has a client record in.
-- Fix: Make client_id NOT NULL (a portal user must always be tied to a specific client)
-- Cleanup: Remove any NULL client_id records first (should not exist in practice)

BEGIN;

-- Verify no NULL client_id records exist (these would be orphaned/broken anyway)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.client_portal_users WHERE client_id IS NULL) THEN
    RAISE NOTICE 'Found % client_portal_users with NULL client_id — deleting (should be 0)',
      (SELECT count(*) FROM public.client_portal_users WHERE client_id IS NULL);
    DELETE FROM public.client_portal_users WHERE client_id IS NULL;
  END IF;
END $$;

-- Make client_id NOT NULL
ALTER TABLE public.client_portal_users
  ALTER COLUMN client_id SET NOT NULL;

-- Add comment documenting the constraint
COMMENT ON COLUMN public.client_portal_users.client_id IS
  'Must always be set. A portal user is always tied to a specific client record. NULL is not allowed.';

COMMIT;
