create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  timezone text not null default 'Asia/Dhaka',
  currency text not null default 'USD',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.strategies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  status text not null default 'active' check (status in ('active','testing','archived')),
  markets text[] not null default '{}',
  primary_timeframe text,
  higher_timeframe text,
  min_rr numeric(10,2),
  preferred_session text,
  current_version integer not null default 1 check (current_version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.strategy_rules (
  id uuid primary key default gen_random_uuid(),
  strategy_id uuid not null references public.strategies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  rule_text text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.strategy_versions (
  id uuid primary key default gen_random_uuid(),
  strategy_id uuid not null references public.strategies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  version integer not null,
  strategy_snapshot jsonb not null default '{}'::jsonb,
  rules_snapshot jsonb not null default '[]'::jsonb,
  change_note text,
  created_at timestamptz not null default now(),
  unique(strategy_id, version)
);

create table public.trades (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  strategy_id uuid references public.strategies(id) on delete set null,
  strategy_version integer,
  symbol text not null,
  direction text not null check (direction in ('long','short')),
  trade_date date not null default current_date,
  entry_time time,
  exit_time time,
  timezone text not null default 'Asia/Dhaka',
  session text,
  timeframe text,
  higher_timeframe text,
  entry_price numeric,
  stop_loss numeric,
  take_profit numeric,
  exit_price numeric,
  risk_percent numeric(10,4),
  planned_rr numeric(10,4),
  actual_r numeric(12,4),
  pnl numeric(14,2),
  result text check (result in ('win','loss','breakeven','open','cancelled')),
  status text not null default 'closed' check (status in ('planned','open','closed','cancelled')),
  grade text check (grade in ('A+','A','B','C','D')),
  emotion text,
  confidence smallint check (confidence between 1 and 5),
  description text,
  thesis text,
  post_trade_review text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.trade_rule_checks (
  id uuid primary key default gen_random_uuid(),
  trade_id uuid not null references public.trades(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  rule_id uuid references public.strategy_rules(id) on delete set null,
  rule_text_snapshot text not null,
  rule_sort_order integer not null default 0,
  status text not null check (status in ('followed','violated','na')),
  created_at timestamptz not null default now()
);

create table public.trade_mistakes (
  id uuid primary key default gen_random_uuid(),
  trade_id uuid not null references public.trades(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  mistake text not null,
  created_at timestamptz not null default now()
);

create table public.trade_images (
  id uuid primary key default gen_random_uuid(),
  trade_id uuid not null references public.trades(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  bucket_path text not null,
  image_type text not null default 'chart' check (image_type in ('before','entry','exit','chart','other')),
  notes text,
  created_at timestamptz not null default now()
);

create index strategies_user_id_idx on public.strategies(user_id);
create index strategy_rules_strategy_idx on public.strategy_rules(strategy_id, sort_order);
create index strategy_rules_user_idx on public.strategy_rules(user_id);
create index strategy_versions_strategy_idx on public.strategy_versions(strategy_id, version desc);
create index trades_user_date_idx on public.trades(user_id, trade_date desc);
create index trades_strategy_idx on public.trades(strategy_id, trade_date desc);
create index trades_symbol_idx on public.trades(user_id, symbol);
create index trade_rule_checks_trade_idx on public.trade_rule_checks(trade_id, rule_sort_order);
create index trade_rule_checks_user_idx on public.trade_rule_checks(user_id);
create index trade_mistakes_trade_idx on public.trade_mistakes(trade_id);
create index trade_images_trade_idx on public.trade_images(trade_id);

create trigger profiles_set_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger strategies_set_updated_at before update on public.strategies for each row execute function public.set_updated_at();
create trigger strategy_rules_set_updated_at before update on public.strategy_rules for each row execute function public.set_updated_at();
create trigger trades_set_updated_at before update on public.trades for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(coalesce(new.email,''), '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.strategies enable row level security;
alter table public.strategy_rules enable row level security;
alter table public.strategy_versions enable row level security;
alter table public.trades enable row level security;
alter table public.trade_rule_checks enable row level security;
alter table public.trade_mistakes enable row level security;
alter table public.trade_images enable row level security;

create policy "profiles_select_own" on public.profiles for select using (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

create policy "strategies_select_own" on public.strategies for select using (auth.uid() = user_id);
create policy "strategies_insert_own" on public.strategies for insert with check (auth.uid() = user_id);
create policy "strategies_update_own" on public.strategies for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "strategies_delete_own" on public.strategies for delete using (auth.uid() = user_id);

create policy "strategy_rules_select_own" on public.strategy_rules for select using (auth.uid() = user_id);
create policy "strategy_rules_insert_own" on public.strategy_rules for insert with check (auth.uid() = user_id);
create policy "strategy_rules_update_own" on public.strategy_rules for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "strategy_rules_delete_own" on public.strategy_rules for delete using (auth.uid() = user_id);

create policy "strategy_versions_select_own" on public.strategy_versions for select using (auth.uid() = user_id);
create policy "strategy_versions_insert_own" on public.strategy_versions for insert with check (auth.uid() = user_id);
create policy "strategy_versions_update_own" on public.strategy_versions for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "strategy_versions_delete_own" on public.strategy_versions for delete using (auth.uid() = user_id);

create policy "trades_select_own" on public.trades for select using (auth.uid() = user_id);
create policy "trades_insert_own" on public.trades for insert with check (auth.uid() = user_id);
create policy "trades_update_own" on public.trades for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "trades_delete_own" on public.trades for delete using (auth.uid() = user_id);

create policy "trade_rule_checks_select_own" on public.trade_rule_checks for select using (auth.uid() = user_id);
create policy "trade_rule_checks_insert_own" on public.trade_rule_checks for insert with check (auth.uid() = user_id);
create policy "trade_rule_checks_update_own" on public.trade_rule_checks for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "trade_rule_checks_delete_own" on public.trade_rule_checks for delete using (auth.uid() = user_id);

create policy "trade_mistakes_select_own" on public.trade_mistakes for select using (auth.uid() = user_id);
create policy "trade_mistakes_insert_own" on public.trade_mistakes for insert with check (auth.uid() = user_id);
create policy "trade_mistakes_update_own" on public.trade_mistakes for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "trade_mistakes_delete_own" on public.trade_mistakes for delete using (auth.uid() = user_id);

create policy "trade_images_select_own" on public.trade_images for select using (auth.uid() = user_id);
create policy "trade_images_insert_own" on public.trade_images for insert with check (auth.uid() = user_id);
create policy "trade_images_update_own" on public.trade_images for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "trade_images_delete_own" on public.trade_images for delete using (auth.uid() = user_id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('trade-screenshots', 'trade-screenshots', false, 10485760, array['image/png','image/jpeg','image/webp'])
on conflict (id) do nothing;

create policy "trade_screenshots_select_own" on storage.objects
for select to authenticated
using (bucket_id = 'trade-screenshots' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "trade_screenshots_insert_own" on storage.objects
for insert to authenticated
with check (bucket_id = 'trade-screenshots' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "trade_screenshots_update_own" on storage.objects
for update to authenticated
using (bucket_id = 'trade-screenshots' and (storage.foldername(name))[1] = auth.uid()::text)
with check (bucket_id = 'trade-screenshots' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "trade_screenshots_delete_own" on storage.objects
for delete to authenticated
using (bucket_id = 'trade-screenshots' and (storage.foldername(name))[1] = auth.uid()::text);
