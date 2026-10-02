# Changelog

## 2026-10-02

- Dashboard analytics are now scoped to one selected strategy instead of aggregating all strategies.
- Added a strategy selector to the dashboard.
- The last dashboard strategy selected by each user is remembered on that browser/device.
- Added strategy-specific Win Rate, Loss Rate, W/L Ratio, Net R, Profit Factor, Rule Adherence, recent trades, and strategy performance.
- Added broker-aware Forex and Gold lot-size calculation to Quick Trade using account balance, risk %, entry and stop distance.
- Cross-currency Forex sizing supports a manual quote-to-account conversion rate when required.
- Broker-dependent instruments such as indices and crypto no longer receive a misleading generic lot number; the journal records no lot size until a valid contract specification is available.
- Added direct Quick Trade chart evidence upload with clipboard paste, image preview and Before Entry / Entry / Chart classification.
- Added economic-calendar proximity warnings for relevant high/medium-impact events within ±60 minutes of the planned entry time.
- Added contextual superscript info tooltips across dashboard metrics, reports, Quick Trade fields, strategy comparison, correlations, playbook and calendar terms; desktop supports hover/focus and mobile supports tap-to-open explanations.
