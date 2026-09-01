-- ==============================================================================
-- Forge AI: Company-Sourced Tickets, Assignments, and Telemetry Migration
-- ==============================================================================

-- 1. Create companies table
create table if not exists public.companies (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    contact_email text not null,
    created_at timestamptz default now()
);

-- 2. Create company_users table (links Supabase auth users to a company with role)
create table if not exists public.company_users (
    id uuid primary key default gen_random_uuid(),
    company_id uuid references public.companies(id) on delete cascade not null,
    user_id uuid references auth.users(id) on delete cascade not null,
    role text not null default 'member', -- 'admin' | 'member'
    created_at timestamptz default now(),
    unique (company_id, user_id)
);

-- 3. Create company_tickets table (bug + reference fix + agent-drafted test suite)
create table if not exists public.company_tickets (
    id uuid primary key default gen_random_uuid(),
    company_id uuid references public.companies(id) on delete cascade not null,
    bug_description text not null,
    reference_fix_code text not null,
    function_signature text not null,
    generated_test_suite text,
    status text not null default 'draft', -- 'draft' | 'pending_review' | 'approved' | 'rejected'
    created_at timestamptz default now(),
    reviewed_by uuid references auth.users(id),
    reviewed_at timestamptz
);

-- 4. Create assignments table (live candidate invite tokens)
create table if not exists public.assignments (
    id uuid primary key default gen_random_uuid(),
    token text not null unique,
    company_ticket_id uuid references public.company_tickets(id) on delete cascade not null,
    candidate_email text,
    status text not null default 'pending', -- 'pending' | 'in_progress' | 'submitted'
    created_at timestamptz default now(),
    expires_at timestamptz
);

-- 5. Extend existing submissions table with assignment, company, and telemetry tracking
alter table public.submissions add column if not exists assignment_id uuid references public.assignments(id);
alter table public.submissions add column if not exists company_id uuid references public.companies(id);
alter table public.submissions add column if not exists telemetry jsonb;

-- 6. Enable Row Level Security (RLS)
alter table public.companies enable row level security;
alter table public.company_users enable row level security;
alter table public.company_tickets enable row level security;
alter table public.assignments enable row level security;

-- 7. RLS Policies

-- Company Members can view their company
create policy "Company members can view their company"
    on public.companies for select
    using (exists (
        select 1 from public.company_users
        where public.company_users.company_id = public.companies.id
        and public.company_users.user_id = auth.uid()
    ));

-- Company Members can manage their tickets
create policy "Company members can manage their company tickets"
    on public.company_tickets for all
    using (exists (
        select 1 from public.company_users
        where public.company_users.company_id = public.company_tickets.company_id
        and public.company_users.user_id = auth.uid()
    ));

-- Company Members can manage their assignments
create policy "Company members can manage their assignments"
    on public.assignments for all
    using (exists (
        select 1 from public.company_tickets
        join public.company_users on public.company_users.company_id = public.company_tickets.company_id
        where public.company_tickets.id = public.assignments.company_ticket_id
        and public.company_users.user_id = auth.uid()
    ));
