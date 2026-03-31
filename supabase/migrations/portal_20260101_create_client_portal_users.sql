-- Migration: portal_20260101_create_client_portal_users.sql
-- Creates the client_portal_users table for portal authentication
-- Source: F:\simplifica-copilot\supabase\migrations\20260101000000_initial_base_schema.sql (lines 614-623)

CREATE TABLE IF NOT EXISTS public.client_portal_users (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id uuid NOT NULL,
    client_id uuid NOT NULL,
    email text NOT NULL,
    auth_user_id uuid,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid
);

-- Add unique constraint for company + email
ALTER TABLE public.client_portal_users
ADD CONSTRAINT client_portal_users_company_email_unique UNIQUE (company_id, email);

-- Add indexes for common queries
CREATE INDEX client_portal_users_company_id_idx ON public.client_portal_users(company_id);
CREATE INDEX client_portal_users_client_id_idx ON public.client_portal_users(client_id);
CREATE INDEX client_portal_users_email_idx ON public.client_portal_users(email);
CREATE INDEX client_portal_users_auth_user_id_idx ON public.client_portal_users(auth_user_id);

-- Enable RLS
ALTER TABLE public.client_portal_users ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Allow authenticated users to read their own company portal users
CREATE POLICY "client_portal_users_company_read_policy"
ON public.client_portal_users FOR SELECT
TO authenticated
USING (
    company_id IN (
        SELECT company_id FROM company_members
        WHERE user_id = auth.uid()
        AND status = 'active'
    )
);

-- Allow service role to manage portal users (for invite flow)
CREATE POLICY "client_portal_users_service_role_policy"
ON public.client_portal_users FOR ALL
TO service_role
USING (true)
WITH CHECK (true);
