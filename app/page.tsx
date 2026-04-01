'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { TrendingUp, TrendingDown, Wifi, WifiOff, Zap } from 'lucide-react'
import { useCryptoStore, COINS, TIMEFRAMES } from '@/lib/store'
import { fetchKlines, fetchTickers, connectWebSocket, disconnectWebSocket } from '@/lib/binance'

const CandleChart = dynamic(() => import('@/components/CandleChart'), { ssr: false })

// ── Helpers ───────────────────────────────────────────────────────────────────
const SURFACE = '#0f0f17'
const BORDER  = '#1e1e32'

function fmt(n: number, decimals = 2) {
  if (n >= 1000) return new Intl.NumberFormat('en-US', { maximumFractionDigits: decimals }).format(n)
  return n.toFixed(n < 1 ? 4 : decimals)
}

function fmtVol(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`
  return n.toFixed(0)
}

function fmtTime(ts: number) {
  return new Date(ts).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

// ── Ticker Card ───────────────────────────────────────────────────────────────
function TickerCard({ coin, active, onClick }: {
  coin: typeof COINS[0]; active: boolean; onClick: () => void
}) {
  const ticker = useCryptoStore(s => s.tickers[coin.symbol])
  const pos    = (ticker?.pct24h ?? 0) >= 0

  return (
    <button onClick={onClick}
      className="flex flex-col gap-1 p-3 rounded-xl transition-all text-left"
      style={{
        background: active ? `${coin.color}15` : SURFACE,
        border:     `1px solid ${active ? coin.color + '60' : BORDER}`,
        minWidth: 120,
      }}>
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full" style={{ background: coin.color }} />
        <span className="text-xs font-bold text-zinc-300">{coin.short}</span>
      </div>
      <div className="text-base font-bold text-white font-mono">
        {ticker ? `$${fmt(ticker.price)}` : '—'}
      </div>
      <div className={`text-xs font-medium flex items-center gap-0.5 ${pos ? 'text-emerald-400' : 'text-red-400'}`}>
        {pos ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
        {ticker ? `${pos ? '+' : ''}${ticker.pct24h.toFixed(2)}%` : '—'}
      </div>
    </button>
  )
}

// ── Stats Bar ─────────────────────────────────────────────────────────────────
function StatsBar({ symbol }: { symbol: string }) {
  const ticker = useCryptoStore(s => s.tickers[symbol])
  if (!ticker) return null

  const stats = [
    { label: '24h High', value: `$${fmt(ticker.high24h)}`, color: '#26a69a' },
    { label: '24h Low',  value: `$${fmt(ticker.low24h)}`,  color: '#ef5350' },
    { label: 'Volume',   value: fmtVol(ticker.volume24h),  color: '#6b6b8a' },
    { label: '24h Chg',  value: `${ticker.change24h >= 0 ? '+' : ''}$${fmt(Math.abs(ticker.change24h))}`,
      color: ticker.change24h >= 0 ? '#26a69a' : '#ef5350' },
  ]

  return (
    <div className="flex gap-6 flex-wrap">
      {stats.map(s => (
        <div key={s.label}>
          <div className="text-xs text-zinc-600 uppercase tracking-wider">{s.label}</div>
          <div className="text-sm font-mono font-semibold" style={{ color: s.color }}>{s.value}</div>
        </div>
      ))}
    </div>
  )
}

// ── Anomaly Feed ──────────────────────────────────────────────────────────────
function AnomalyFeed() {
  const anomalies = useCryptoStore(s => s.anomalies)

  return (
    <div style={{ background: SURFACE, border: `1px solid ${BORDER}` }} className="rounded-xl p-4 h-full">
      <div className="flex items-center gap-2 mb-3">
        <Zap size={13} className="text-yellow-400" />
        <h3 className="text-xs text-zinc-400 uppercase tracking-widest">Anomaly Alerts</h3>
      </div>
      {anomalies.length === 0 ? (
        <p className="text-xs text-zinc-600 mt-6 text-center">No anomalies detected yet</p>
      ) : (
        <div className="flex flex-col gap-2">
          {[...anomalies].reverse().map((a, i) => (
            <div key={i} className="flex items-start gap-2 text-xs p-2 rounded-lg"
              style={{ background: a.side === 'spike' ? '#26a69a12' : '#ef535012',
                       border: `1px solid ${a.side === 'spike' ? '#26a69a30' : '#ef535030'}` }}>
              <span style={{ color: a.side === 'spike' ? '#26a69a' : '#ef5350' }}>
                {a.side === 'spike' ? '↑' : '↓'}
              </span>
              <div>
                <div className="font-mono" style={{ color: a.side === 'spike' ? '#26a69a' : '#ef5350' }}>
                  ${fmt(a.price)} &nbsp;<span className="text-zinc-500">z={a.zscore}</span>
                </div>
                <div className="text-zinc-600">{fmtTime(a.time * 1000)}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Recent Trades ─────────────────────────────────────────────────────────────
function RecentTrades() {
  const trades = useCryptoStore(s => s.trades)

  return (
    <div style={{ background: SURFACE, border: `1px solid ${BORDER}` }} className="rounded-xl p-4">
      <h3 className="text-xs text-zinc-400 uppercase tracking-widest mb-3">Recent Trades</h3>
      <div className="flex flex-col gap-0.5 max-h-72 overflow-y-auto">
        {trades.length === 0 && <p className="text-xs text-zinc-600 text-center py-4">Waiting for trades...</p>}
        {trades.map(t => (
          <div key={t.id} className="grid grid-cols-3 text-xs font-mono py-0.5">
            <span style={{ color: t.isBuyer ? '#26a69a' : '#ef5350' }}>
              ${fmt(t.price)}
            </span>
            <span className="text-zinc-400 text-right">{t.qty.toFixed(4)}</span>
            <span className="text-zinc-600 text-right">{fmtTime(t.time)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function CryptoDashboard() {
  const { activeCoin, activeInterval, connected, setActiveCoin, setActiveInterval, candles, anomalies } = useCryptoStore()
  const [loading, setLoading] = useState(true)

  const coin = COINS.find(c => c.symbol === activeCoin) ?? COINS[0]

  // Load historical + connect WS on coin/interval change
  useEffect(() => {
    let cancelled = false
    setLoading(true)

    fetchKlines(activeCoin, activeInterval).then(data => {
      if (cancelled) return
      useCryptoStore.getState().setCandles(data)
      setLoading(false)
    })

    connectWebSocket(activeCoin, activeInterval)
    return () => { cancelled = true; disconnectWebSocket() }
  }, [activeCoin, activeInterval])

  // Poll all tickers every 5s
  useEffect(() => {
    const symbols = COINS.map(c => c.symbol)
    fetchTickers(symbols)
    const iv = setInterval(() => fetchTickers(symbols), 5000)
    return () => clearInterval(iv)
  }, [])

  const ticker = useCryptoStore(s => s.tickers[activeCoin])
  const pos    = (ticker?.pct24h ?? 0) >= 0

  return (
    <div className="min-h-screen" style={{ background: '#0a0a0f' }}>
      {/* Header */}
      <header style={{ background: SURFACE, borderBottom: `1px solid ${BORDER}` }}>
        <div className="max-w-screen-xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="text-lg font-bold text-white tracking-tight">Crypto<span style={{ color: '#6366f1' }}>Live</span></div>
            <div className="hidden sm:flex items-center gap-1.5 text-xs px-2 py-1 rounded-md"
              style={{ background: connected ? '#26a69a15' : '#ef535015',
                       border: `1px solid ${connected ? '#26a69a40' : '#ef535040'}` }}>
              {connected
                ? <><Wifi size={11} className="text-emerald-400" /><span className="text-emerald-400">Live</span></>
                : <><WifiOff size={11} className="text-red-400" /><span className="text-red-400">Connecting...</span></>}
            </div>
          </div>

          {/* Ticker strip */}
          <div className="flex gap-2 overflow-x-auto pb-0.5">
            {COINS.map(c => (
              <TickerCard key={c.symbol} coin={c} active={activeCoin === c.symbol}
                onClick={() => setActiveCoin(c.symbol)} />
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-screen-xl mx-auto px-4 py-5">
        {/* Coin header */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full" style={{ background: coin.color }} />
            <h1 className="text-xl font-bold text-white">{coin.name}
              <span className="text-zinc-500 font-normal text-sm ml-2">/ USDT</span>
            </h1>
            {ticker && (
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold font-mono text-white">${fmt(ticker.price)}</span>
                <span className={`text-sm font-semibold ${pos ? 'text-emerald-400' : 'text-red-400'}`}>
                  {pos ? '+' : ''}{ticker.pct24h.toFixed(2)}%
                </span>
              </div>
            )}
          </div>
          <StatsBar symbol={activeCoin} />
        </div>

        {/* Timeframe selector */}
        <div className="flex gap-1 mb-4">
          {TIMEFRAMES.map(tf => (
            <button key={tf.interval} onClick={() => setActiveInterval(tf.interval)}
              className="px-3 py-1 text-xs rounded-md font-medium transition-all"
              style={{
                background: activeInterval === tf.interval ? '#6366f1' : SURFACE,
                color:      activeInterval === tf.interval ? '#fff' : '#71717a',
                border:     `1px solid ${activeInterval === tf.interval ? '#6366f1' : BORDER}`,
              }}>
              {tf.label}
            </button>
          ))}
        </div>

        {/* Chart + side panels */}
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
          {/* Chart */}
          <div className="xl:col-span-3 flex flex-col gap-4">
            <div style={{ background: SURFACE, border: `1px solid ${BORDER}` }}
              className="rounded-xl overflow-hidden relative">
              {loading && (
                <div className="absolute inset-0 z-10 flex items-center justify-center"
                  style={{ background: '#0f0f17ee' }}>
                  <div className="text-zinc-500 text-sm animate-pulse">Loading {activeInterval} data...</div>
                </div>
              )}
              <CandleChart candles={candles} anomalies={anomalies} color={coin.color} />
            </div>
            <RecentTrades />
          </div>

          {/* Side */}
          <div className="flex flex-col gap-4">
            <AnomalyFeed />

            {/* Order book depth indicator */}
            {ticker && (
              <div style={{ background: SURFACE, border: `1px solid ${BORDER}` }} className="rounded-xl p-4">
                <h3 className="text-xs text-zinc-400 uppercase tracking-widest mb-3">24h Range</h3>
                <div className="flex justify-between text-xs font-mono mb-2">
                  <span className="text-red-400">${fmt(ticker.low24h)}</span>
                  <span className="text-emerald-400">${fmt(ticker.high24h)}</span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: BORDER }}>
                  <div className="h-full rounded-full transition-all"
                    style={{
                      width: `${((ticker.price - ticker.low24h) / (ticker.high24h - ticker.low24h)) * 100}%`,
                      background: `linear-gradient(to right, #ef5350, #26a69a)`,
                    }} />
                </div>
                <div className="text-xs text-center text-zinc-500 mt-1.5 font-mono">
                  ${fmt(ticker.price)}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      <footer className="max-w-screen-xl mx-auto px-4 py-4"
        style={{ borderTop: `1px solid ${BORDER}` }}>
        <p className="text-xs text-zinc-700">
          Real-time data via Binance WebSocket · Built by{' '}
          <a href="https://github.com/santiagomalak" className="hover:text-zinc-500 transition-colors">
            @santiagomalak
          </a>
        </p>
      </footer>
    </div>
  )
}
