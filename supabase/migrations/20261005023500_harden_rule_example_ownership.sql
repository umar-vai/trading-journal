drop policy if exists "rule_examples_insert_own" on public.rule_examples;
drop policy if exists "rule_examples_update_own" on public.rule_examples;

create policy "rule_examples_insert_own" on public.rule_examples
for insert to authenticated
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.strategies s
    where s.id = strategy_id and s.user_id = (select auth.uid())
  )
  and (
    rule_id is null or exists (
      select 1 from public.strategy_rules r
      where r.id = rule_id
        and r.strategy_id = strategy_id
        and r.user_id = (select auth.uid())
    )
  )
);

create policy "rule_examples_update_own" on public.rule_examples
for update to authenticated
using ((select auth.uid()) = user_id)
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.strategies s
    where s.id = strategy_id and s.user_id = (select auth.uid())
  )
  and (
    rule_id is null or exists (
      select 1 from public.strategy_rules r
      where r.id = rule_id
        and r.strategy_id = strategy_id
        and r.user_id = (select auth.uid())
    )
  )
);
