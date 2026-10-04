create table if not exists public.rule_examples (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  strategy_id uuid not null references public.strategies(id) on delete cascade,
  rule_id uuid references public.strategy_rules(id) on delete set null,
  rule_text_snapshot text not null,
  rule_sort_order integer not null default 0,
  bucket_path text not null,
  caption text,
  created_at timestamptz not null default now()
);

create index if not exists rule_examples_user_idx on public.rule_examples(user_id);
create index if not exists rule_examples_strategy_idx on public.rule_examples(strategy_id, rule_sort_order, created_at);
create index if not exists rule_examples_rule_idx on public.rule_examples(rule_id) where rule_id is not null;

alter table public.rule_examples enable row level security;

drop policy if exists "rule_examples_select_own" on public.rule_examples;
drop policy if exists "rule_examples_insert_own" on public.rule_examples;
drop policy if exists "rule_examples_update_own" on public.rule_examples;
drop policy if exists "rule_examples_delete_own" on public.rule_examples;

create policy "rule_examples_select_own" on public.rule_examples
for select to authenticated using ((select auth.uid()) = user_id);

create policy "rule_examples_insert_own" on public.rule_examples
for insert to authenticated with check ((select auth.uid()) = user_id);

create policy "rule_examples_update_own" on public.rule_examples
for update to authenticated using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "rule_examples_delete_own" on public.rule_examples
for delete to authenticated using ((select auth.uid()) = user_id);
