import { useEffect, useRef, useState } from 'react'

const HELP: Record<string, string> = {
  'total trades': 'The number of trades included in the current filter or strategy sample.',
  'win rate': 'Winning trades divided by decisive trades (wins + losses). Breakeven and open trades are not counted as wins or losses.',
  'loss rate': 'Losing trades divided by decisive trades (wins + losses).',
  'w/l ratio': 'The number of winning trades divided by losing trades. This is a count ratio, not a reward-to-risk ratio.',
  'net r': 'Total realized R across the selected trades. R normalizes performance by the amount originally risked on each trade.',
  'expectancy': 'Average R earned or lost per trade. Positive expectancy means the strategy has produced a positive average outcome in the recorded sample.',
  'profit factor': 'Gross winning R divided by gross losing R. Above 1 means gross wins exceed gross losses; higher is generally better, but sample size matters.',
  'rule adherence': 'The percentage of checked strategy rules marked as followed rather than violated. N/A checks are excluded.',
  'max drawdown': 'The largest peak-to-trough decline in the cumulative R curve during the selected sample.',
  'sample size': 'How many trades are included. Very small samples can produce misleading win rates and expectancy.',
  'planned rr': 'Planned reward-to-risk ratio from Entry, Stop Loss and Take Profit. 1:2 means the planned reward is twice the initial risk.',
  'risk amount': 'The money you intend to lose if the stop loss is hit. Calculated from Account Balance × Risk %.',
  'lot size': 'Suggested position size based on your risk amount, stop distance and the instrument contract/pip model. Always confirm broker contract specifications before execution.',
  'raw position size': 'A simple risk amount ÷ price-distance calculation. It is not a broker-exact lot size unless contract value is accounted for.',
  'stop distance': 'The distance between Entry and Stop Loss, shown in pips for supported Forex pairs or price distance for other instruments.',
  'realized r': 'The actual result expressed in R. +2R means profit equaled twice the initial risk; -1R means the full planned risk was lost.',
  'account balance': 'The account value used for risk calculations. This does not change your broker account; it is only used inside the journal.',
  'risk %': 'The percentage of account balance you plan to risk on this trade.',
  'entry': 'The price at which the trade was or will be opened.',
  'stop loss': 'The invalidation/exit price that defines the initial trade risk.',
  'take profit': 'The planned target price used to estimate reward-to-risk.',
  'exit price': 'The price at which the trade was closed. It is used with Entry and Stop Loss to calculate realized R.',
  'pair': 'The market/instrument being traded, for example XAUUSD, EURUSD or NAS100.',
  'direction': 'Long means you expect price to rise. Short means you expect price to fall.',
  'timeframe': 'The chart interval used for the setup or entry, such as 5M, 1H or 4H.',
  'session': 'The market session in which the trade was taken, such as Asian, London or New York.',
  'strategy': 'The trading setup/model whose rules this trade should follow. Keeping trades linked to strategies allows accurate strategy-level analysis.',
  'quote → account rate': 'A conversion rate used when the pair quote currency differs from your account currency. It is needed to convert pip value into the account currency.',
  'economic-news proximity': 'Shows relevant medium/high-impact economic events close to your planned entry time so you can see whether the trade was exposed to scheduled news risk.',
  'high impact': 'A scheduled economic event commonly associated with larger market volatility, such as CPI, NFP or a central-bank rate decision.',
  'medium impact': 'A scheduled economic event that can move markets but is usually less influential than a high-impact event.',
  'forecast': 'The market consensus estimate before the economic data is released.',
  'previous': 'The previously reported value for that economic indicator.',
  'actual': 'The released value after the event occurs.',
  'chart evidence': 'A screenshot attached to the trade so you can review what the setup looked like before, during or after execution.',
  'rule check': 'A record of whether each strategy rule was followed, violated or not applicable for this trade.',
  'confidence': 'Your self-rated confidence before or during the trade. It can later be compared with actual performance.',
  'execution rating': 'A subjective review score for how well you executed the plan, independent of whether the trade won or lost.',
  'cumulative r': 'A running total of realized R. This helps compare trading performance without account-size changes distorting the curve.',
  'equity curve': 'A running performance curve based on recorded P/L. It shows growth and drawdowns over time.',
  'correlations': 'Compares performance when a rule/mistake is present versus absent. Correlation can reveal patterns, but it does not prove causation.',
  'mistake cost': 'Estimated performance difference between trades with a specific mistake and trades without it.',
  'playbook': 'A library of high-quality setups you want to repeat. Playbook entries can preserve setup context, confirmation and invalidation criteria.',
  'strategy compare': 'Side-by-side performance comparison of multiple strategies using the same journal metrics.',
  'sample strength': 'A rough confidence indicator based on the number of recorded trades. More trades generally make performance estimates more reliable.',
  'open trade': 'A trade that has been entered but does not yet have a final exit/result.',
  'breakeven': 'A trade that finished close enough to 0R that it is treated as neither a win nor a loss.',
  'r': 'R is one unit of initial risk. If you risk $100, then +1R = +$100 and -1R = -$100.',
}

function normalize(label: string) {
  return String(label || '').toLowerCase().replace(/\s+/g, ' ').trim()
}

export function getHelpText(label: string) {
  const key = normalize(label)
  if (HELP[key]) return HELP[key]
  const direct = Object.keys(HELP).find((item) => key.includes(item))
  return direct ? HELP[direct] : ''
}

export function InfoTip({ label, text }: { label?: string; text?: string }) {
  const help = text || getHelpText(label || '')
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (event: PointerEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [open])

  if (!help) return null

  return (
    <span ref={wrapRef} className={`info-tip-wrap${open ? ' is-open' : ''}`}>
      <button
        type="button"
        className="info-tip-button"
        aria-label={`About ${label || 'this metric'}`}
        aria-expanded={open}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.preventDefault()
          event.stopPropagation()
          setOpen((value) => !value)
        }}
      >
        i
      </button>
      <span className="info-tip-popover" role="tooltip">{help}</span>
    </span>
  )
}

export function InfoLabel({ label, help }: { label: string; help?: string }) {
  return <span className="info-label-text">{label}<InfoTip label={label} text={help} /></span>
}
