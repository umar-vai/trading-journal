create index if not exists strategy_versions_user_idx on public.strategy_versions(user_id);
create index if not exists trade_images_user_idx on public.trade_images(user_id);
create index if not exists trade_mistakes_user_idx on public.trade_mistakes(user_id);
create index if not exists trade_rule_checks_rule_idx on public.trade_rule_checks(rule_id);

alter policy "profiles_select_own" on public.profiles using ((select auth.uid()) = id);
alter policy "profiles_update_own" on public.profiles using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

alter policy "strategies_select_own" on public.strategies using ((select auth.uid()) = user_id);
alter policy "strategies_insert_own" on public.strategies with check ((select auth.uid()) = user_id);
alter policy "strategies_update_own" on public.strategies using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
alter policy "strategies_delete_own" on public.strategies using ((select auth.uid()) = user_id);

alter policy "strategy_rules_select_own" on public.strategy_rules using ((select auth.uid()) = user_id);
alter policy "strategy_rules_insert_own" on public.strategy_rules with check ((select auth.uid()) = user_id);
alter policy "strategy_rules_update_own" on public.strategy_rules using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
alter policy "strategy_rules_delete_own" on public.strategy_rules using ((select auth.uid()) = user_id);

alter policy "strategy_versions_select_own" on public.strategy_versions using ((select auth.uid()) = user_id);
alter policy "strategy_versions_insert_own" on public.strategy_versions with check ((select auth.uid()) = user_id);
alter policy "strategy_versions_update_own" on public.strategy_versions using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
alter policy "strategy_versions_delete_own" on public.strategy_versions using ((select auth.uid()) = user_id);

alter policy "trades_select_own" on public.trades using ((select auth.uid()) = user_id);
alter policy "trades_insert_own" on public.trades with check ((select auth.uid()) = user_id);
alter policy "trades_update_own" on public.trades using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
alter policy "trades_delete_own" on public.trades using ((select auth.uid()) = user_id);

alter policy "trade_rule_checks_select_own" on public.trade_rule_checks using ((select auth.uid()) = user_id);
alter policy "trade_rule_checks_insert_own" on public.trade_rule_checks with check ((select auth.uid()) = user_id);
alter policy "trade_rule_checks_update_own" on public.trade_rule_checks using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
alter policy "trade_rule_checks_delete_own" on public.trade_rule_checks using ((select auth.uid()) = user_id);

alter policy "trade_mistakes_select_own" on public.trade_mistakes using ((select auth.uid()) = user_id);
alter policy "trade_mistakes_insert_own" on public.trade_mistakes with check ((select auth.uid()) = user_id);
alter policy "trade_mistakes_update_own" on public.trade_mistakes using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
alter policy "trade_mistakes_delete_own" on public.trade_mistakes using ((select auth.uid()) = user_id);

alter policy "trade_images_select_own" on public.trade_images using ((select auth.uid()) = user_id);
alter policy "trade_images_insert_own" on public.trade_images with check ((select auth.uid()) = user_id);
alter policy "trade_images_update_own" on public.trade_images using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
alter policy "trade_images_delete_own" on public.trade_images using ((select auth.uid()) = user_id);
