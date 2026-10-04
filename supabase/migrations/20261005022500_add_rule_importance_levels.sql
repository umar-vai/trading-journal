alter table public.strategy_rules
  add column if not exists importance text not null default 'important';

alter table public.strategy_rules
  drop constraint if exists strategy_rules_importance_check;

alter table public.strategy_rules
  add constraint strategy_rules_importance_check
  check (importance in ('mandatory','important','optional'));

alter table public.trade_rule_checks
  add column if not exists rule_importance_snapshot text not null default 'important';

alter table public.trade_rule_checks
  drop constraint if exists trade_rule_checks_importance_check;

alter table public.trade_rule_checks
  add constraint trade_rule_checks_importance_check
  check (rule_importance_snapshot in ('mandatory','important','optional'));

create index if not exists strategy_rules_importance_idx
  on public.strategy_rules(strategy_id, importance, sort_order);

create index if not exists trade_rule_checks_importance_idx
  on public.trade_rule_checks(trade_id, rule_importance_snapshot);
