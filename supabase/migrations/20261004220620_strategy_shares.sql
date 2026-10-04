create table if not exists public.strategy_shares (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  strategy_id uuid not null references public.strategies(id) on delete cascade,
  token uuid not null default gen_random_uuid() unique,
  share_mode text not null check (share_mode in ('view','clone')),
  strategy_version integer not null default 1,
  snapshot jsonb not null,
  active boolean not null default true,
  import_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz null
);

create index if not exists strategy_shares_owner_strategy_idx on public.strategy_shares(owner_user_id, strategy_id);
create index if not exists strategy_shares_token_active_idx on public.strategy_shares(token, active);

alter table public.strategy_shares enable row level security;

drop policy if exists strategy_shares_select_own on public.strategy_shares;
create policy strategy_shares_select_own on public.strategy_shares
for select to authenticated
using (auth.uid() = owner_user_id);

drop policy if exists strategy_shares_update_own on public.strategy_shares;
create policy strategy_shares_update_own on public.strategy_shares
for update to authenticated
using (auth.uid() = owner_user_id)
with check (auth.uid() = owner_user_id);

drop policy if exists strategy_shares_delete_own on public.strategy_shares;
create policy strategy_shares_delete_own on public.strategy_shares
for delete to authenticated
using (auth.uid() = owner_user_id);

comment on table public.strategy_shares is 'Opaque-token strategy sharing links. Public reads and clone imports are served only through the strategy-share Edge Function.';
comment on column public.strategy_shares.share_mode is 'view = public view only; clone = public view plus authenticated import to recipient profile.';
