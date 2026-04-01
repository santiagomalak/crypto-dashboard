import { create } from 'zustand'

export const COINS = [
  { symbol: 'BTCUSDT', name: 'Bitcoin',  short: 'BTC', color: '#f7931a' },
  { symbol: 'ETHUSDT', name: 'Ethereum', short: 'ETH', color: '#627eea' },
  { symbol: 'SOLUSDT', name: 'Solana',   short: 'SOL', color: '#9945ff' },
  { symbol: 'BNBUSDT', name: 'BNB',      short: 'BNB', color: '#f0b90b' },
  { symbol: 'XRPUSDT', name: 'XRP',      short: 'XRP', color: '#00aae4' },
]

export const TIMEFRAMES = [
  { label: '1m',  interval: '1m'  },
  { label: '5m',  interval: '5m'  },
  { label: '15m', interval: '15m' },
  { label: '1h',  interval: '1h'  },
  { label: '4h',  interval: '4h'  },
  { label: '1d',  interval: '1d'  },
]

export interface Ticker {
  symbol:    string
  price:     number
  change24h: number
  pct24h:    number
  high24h:   number
  low24h:    number
  volume24h: number
}

export interface Trade {
  id:        number
  price:     number
  qty:       number
  isBuyer:   boolean
  time:      number
}

export interface Candle {
  time:   number   // unix seconds
  open:   number
  high:   number
  low:    number
  close:  number
  volume: number
}

export interface Anomaly {
  time:    number
  price:   number
  zscore:  number
  side:    'spike' | 'crash'
}

interface CryptoStore {
  activeCoin:      string
  activeInterval:  string
  tickers:         Record<string, Ticker>
  candles:         Candle[]
  trades:          Trade[]
  anomalies:       Anomaly[]
  connected:       boolean

  setActiveCoin:     (c: string) => void
  setActiveInterval: (i: string) => void
  updateTicker:      (t: Ticker) => void
  setCandles:        (c: Candle[]) => void
  pushCandle:        (c: Candle) => void
  pushTrade:         (t: Trade) => void
  setConnected:      (v: boolean) => void
}

export const useCryptoStore = create<CryptoStore>((set, get) => ({
  activeCoin:     'BTCUSDT',
  activeInterval: '5m',
  tickers:        {},
  candles:        [],
  trades:         [],
  anomalies:      [],
  connected:      false,

  setActiveCoin:     (activeCoin)     => set({ activeCoin, candles: [], trades: [], anomalies: [] }),
  setActiveInterval: (activeInterval) => set({ activeInterval, candles: [], anomalies: [] }),
  updateTicker:      (t) => set(s => ({ tickers: { ...s.tickers, [t.symbol]: t } })),
  setConnected:      (connected) => set({ connected }),

  setCandles: (candles) => set({ candles }),

  pushCandle: (candle) => set(s => {
    const prev = s.candles
    const last = prev[prev.length - 1]
    const updated = last?.time === candle.time
      ? [...prev.slice(0, -1), candle]
      : [...prev.slice(-299), candle]

    // Z-score anomaly detection on last 20 candle returns
    const anomalies = [...s.anomalies]
    if (updated.length >= 20 && last?.time !== candle.time) {
      const returns = updated.slice(-20).map((c, i, arr) =>
        i === 0 ? 0 : (c.close - arr[i - 1].close) / arr[i - 1].close
      ).slice(1)
      const mean = returns.reduce((a, b) => a + b, 0) / returns.length
      const std  = Math.sqrt(returns.map(r => (r - mean) ** 2).reduce((a, b) => a + b, 0) / returns.length)
      const latestReturn = (candle.close - (prev[prev.length - 1]?.close ?? candle.close)) / (prev[prev.length - 1]?.close ?? candle.close)
      const zscore = std > 0 ? (latestReturn - mean) / std : 0

      if (Math.abs(zscore) > 2.5) {
        anomalies.push({
          time:   candle.time,
          price:  candle.close,
          zscore: Math.round(zscore * 100) / 100,
          side:   zscore > 0 ? 'spike' : 'crash',
        })
        if (anomalies.length > 10) anomalies.shift()
      }
    }

    return { candles: updated, anomalies }
  }),

  pushTrade: (trade) => set(s => ({
    trades: [trade, ...s.trades].slice(0, 50)
  })),
}))
