alter table public.trades add column if not exists account_balance numeric(16,2);
alter table public.trades add column if not exists risk_amount numeric(16,2);
alter table public.trades add column if not exists position_size numeric(20,6);

alter table public.profiles add column if not exists default_account_balance numeric(16,2);
alter table public.profiles add column if not exists default_risk_percent numeric(10,4) not null default 1;

create table if not exists public.journal_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  period_type text not null check (period_type in ('daily','weekly')),
  period_start date not null,
  rating smallint check (rating between 1 and 5),
  summary text,
  lessons text,
  next_focus text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, period_type, period_start)
);

create table if not exists public.playbook_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  strategy_id uuid references public.strategies(id) on delete set null,
  source_trade_id uuid references public.trades(id) on delete set null,
  title text not null,
  setup_type text,
  market_conditions text,
  entry_model text,
  confirmation text,
  invalidation text,
  notes text,
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.economic_calendar_cache (
  cache_key text primary key,
  payload jsonb not null default '[]'::jsonb,
  fetched_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create index if not exists journal_reviews_user_period_idx on public.journal_reviews(user_id, period_start desc);
create index if not exists playbook_entries_user_idx on public.playbook_entries(user_id, created_at desc);
create index if not exists playbook_entries_strategy_idx on public.playbook_entries(strategy_id);
create index if not exists economic_calendar_cache_expiry_idx on public.economic_calendar_cache(expires_at);

alter table public.journal_reviews enable row level security;
alter table public.playbook_entries enable row level security;
alter table public.economic_calendar_cache enable row level security;

do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'journal_reviews_set_updated_at') then
    create trigger journal_reviews_set_updated_at before update on public.journal_reviews for each row execute function public.set_updated_at();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'playbook_entries_set_updated_at') then
    create trigger playbook_entries_set_updated_at before update on public.playbook_entries for each row execute function public.set_updated_at();
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='journal_reviews' and policyname='journal_reviews_select_own') then
    create policy journal_reviews_select_own on public.journal_reviews for select using ((select auth.uid()) = user_id);
    create policy journal_reviews_insert_own on public.journal_reviews for insert with check ((select auth.uid()) = user_id);
    create policy journal_reviews_update_own on public.journal_reviews for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
    create policy journal_reviews_delete_own on public.journal_reviews for delete using ((select auth.uid()) = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='playbook_entries' and policyname='playbook_entries_select_own') then
    create policy playbook_entries_select_own on public.playbook_entries for select using ((select auth.uid()) = user_id);
    create policy playbook_entries_insert_own on public.playbook_entries for insert with check ((select auth.uid()) = user_id);
    create policy playbook_entries_update_own on public.playbook_entries for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
    create policy playbook_entries_delete_own on public.playbook_entries for delete using ((select auth.uid()) = user_id);
  end if;
end $$;

-- economic_calendar_cache intentionally has no authenticated policies.
-- It is accessed only by service-role Edge Functions.