# Crypto Live Dashboard

> Real-time crypto dashboard with TradingView candlestick charts, live trade feed and z-score anomaly detection.  
> Live demo → **[crypto-dashboard-five-dun.vercel.app](https://crypto-dashboard-five-dun.vercel.app)**

![Stack](https://img.shields.io/badge/Next.js-14-black?logo=next.js)
![Stack](https://img.shields.io/badge/Binance-WebSocket-f0b90b?logo=binance&logoColor=black)
![Stack](https://img.shields.io/badge/lightweight--charts-v5-4c6ef5)
![Stack](https://img.shields.io/badge/Zustand-state-ff6b6b)

---

## Overview

A production-ready crypto analytics dashboard that connects directly to **Binance public WebSocket streams** — no API key required. Combines real-time data with z-score statistical analysis to surface price anomalies as they happen.

### Supported assets
**BTC · ETH · SOL · BNB · XRP** (vs USDT)

### Features
| Feature | Detail |
|---------|--------|
| **Candlestick chart** | TradingView `lightweight-charts` v5 — OHLCV rendering |
| **Volume panel** | Histogram overlay in the same chart pane |
| **6 timeframes** | 1m · 5m · 15m · 1h · 4h · 1d |
| **Live trades feed** | Real-time `@trade` stream with buy/sell color coding |
| **Anomaly detection** | Z-score on 20-candle price returns, threshold \|z\| > 2.5 |
| **Anomaly markers** | Up/down arrows rendered directly on the chart |
| **24h ticker** | Price, change %, volume — polled every 5 s via REST |

---

## Architecture

```
Binance Public API (no auth required)
  ├── REST  /api/v3/klines          → historical OHLCV on mount
  ├── REST  /api/v3/ticker/24hr     → 24h stats polled every 5 s
  └── WSS   stream.binance.com:9443
        ├── {symbol}@kline_{interval}  → live candle updates
        └── {symbol}@trade             → real-time trade feed

Zustand store (lib/store.ts)
  ├── tickers   — 24h price data per coin
  ├── candles   — OHLCV arrays per symbol+interval
  ├── trades    — rolling 50-trade feed
  └── anomalies — flagged candles with z-score

Components
  ├── CandleChart.tsx   (lightweight-charts v5, SSR-disabled)
  ├── TickerCard        (price + change %)
  ├── AnomalyFeed       (live anomaly list)
  └── RecentTrades      (buy/sell trade stream)
```

---

## Tech Stack

| Layer | Tool |
|-------|------|
| Framework | **Next.js 14** App Router |
| Charts | **lightweight-charts** v5 (TradingView) |
| State | **Zustand** |
| Data | **Binance WebSocket API** (public, no key) |
| Styling | **Tailwind CSS** |
| Deploy | **Vercel** |

---

## Anomaly Detection

For each new candle the store computes the **z-score of the price return** over a rolling 20-candle window:

```
return_i  = (close_i - close_{i-1}) / close_{i-1}
z_i       = (return_i - mean(returns)) / std(returns)
anomaly   = |z_i| > 2.5
```

Flagged candles appear as arrow markers on the chart and in the Anomaly Feed panel.

---

## Local Setup

```bash
git clone https://github.com/santiagomalak/crypto-dashboard.git
cd crypto-dashboard
npm install
npm run dev
```

No `.env` needed — all data comes from Binance's public endpoints.

Open [http://localhost:3000](http://localhost:3000).

---

## Related

- **[Portfolio](https://santiagomalak.is-a.dev/dashboards)** — live embed + project context
