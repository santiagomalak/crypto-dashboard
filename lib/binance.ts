import { useCryptoStore, Candle } from './store'

const BASE_REST = 'https://api.binance.com/api/v3'

// ── REST: fetch historical klines ────────────────────────────────────────────
export async function fetchKlines(symbol: string, interval: string, limit = 300): Promise<Candle[]> {
  const res  = await fetch(`${BASE_REST}/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`)
  const data = await res.json()
  return (data as number[][]).map(k => ({
    time:   Math.floor(k[0] / 1000),
    open:   parseFloat(String(k[1])),
    high:   parseFloat(String(k[2])),
    low:    parseFloat(String(k[3])),
    close:  parseFloat(String(k[4])),
    volume: parseFloat(String(k[5])),
  }))
}

// ── REST: fetch 24h ticker for all coins ────────────────────────────────────
export async function fetchTickers(symbols: string[]) {
  const store = useCryptoStore.getState()
  for (const symbol of symbols) {
    try {
      const res  = await fetch(`${BASE_REST}/ticker/24hr?symbol=${symbol}`)
      const d    = await res.json()
      store.updateTicker({
        symbol,
        price:     parseFloat(d.lastPrice),
        change24h: parseFloat(d.priceChange),
        pct24h:    parseFloat(d.priceChangePercent),
        high24h:   parseFloat(d.highPrice),
        low24h:    parseFloat(d.lowPrice),
        volume24h: parseFloat(d.volume),
      })
    } catch { /* ignore */ }
  }
}

// ── WebSocket manager ─────────────────────────────────────────────────────────
let ws: WebSocket | null = null

export function connectWebSocket(symbol: string, interval: string) {
  if (ws) { ws.close(); ws = null }

  const store    = useCryptoStore.getState()
  const symLower = symbol.toLowerCase()
  const streams  = [
    `${symLower}@kline_${interval}`,
    `${symLower}@trade`,
  ].join('/')

  ws = new WebSocket(`wss://stream.binance.com:9443/stream?streams=${streams}`)

  ws.onopen  = () => store.setConnected(true)
  ws.onclose = () => store.setConnected(false)
  ws.onerror = () => store.setConnected(false)

  ws.onmessage = (evt) => {
    const msg  = JSON.parse(evt.data)
    const data = msg.data

    if (data.e === 'kline') {
      const k = data.k
      store.pushCandle({
        time:   Math.floor(k.t / 1000),
        open:   parseFloat(k.o),
        high:   parseFloat(k.h),
        low:    parseFloat(k.l),
        close:  parseFloat(k.c),
        volume: parseFloat(k.v),
      })
      // Update ticker price live
      const ticker = store.tickers[symbol]
      if (ticker) {
        store.updateTicker({ ...ticker, price: parseFloat(k.c) })
      }
    }

    if (data.e === 'trade') {
      store.pushTrade({
        id:      data.t,
        price:   parseFloat(data.p),
        qty:     parseFloat(data.q),
        isBuyer: data.m === false,
        time:    data.T,
      })
    }
  }
}

export function disconnectWebSocket() {
  if (ws) { ws.close(); ws = null }
}
