'use client'

import { useEffect, useRef } from 'react'
import {
  createChart, ColorType, CrosshairMode,
  CandlestickSeries, HistogramSeries, createSeriesMarkers,
  type IChartApi, type UTCTimestamp,
} from 'lightweight-charts'
import { Candle, Anomaly } from '@/lib/store'

interface Props {
  candles:   Candle[]
  anomalies: Anomaly[]
  color:     string
}

export default function CandleChart({ candles, anomalies, color }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef     = useRef<IChartApi | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const candleRef    = useRef<any>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const volRef       = useRef<any>(null)

  useEffect(() => {
    if (!containerRef.current) return

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#0f0f17' },
        textColor:  '#6b6b8a',
      },
      grid: {
        vertLines: { color: '#1e1e32' },
        horzLines: { color: '#1e1e32' },
      },
      crosshair:       { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: '#1e1e32' },
      timeScale: {
        borderColor:    '#1e1e32',
        timeVisible:    true,
        secondsVisible: false,
      },
      width:  containerRef.current.clientWidth,
      height: 380,
    })

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor:         '#26a69a',
      downColor:       '#ef5350',
      borderUpColor:   '#26a69a',
      borderDownColor: '#ef5350',
      wickUpColor:     '#26a69a',
      wickDownColor:   '#ef5350',
    })

    const volSeries = chart.addSeries(HistogramSeries, {
      color:        color + '55',
      priceFormat:  { type: 'volume' as const },
      priceScaleId: 'vol',
    })

    chart.priceScale('vol').applyOptions({
      scaleMargins: { top: 0.85, bottom: 0 },
    })

    chartRef.current  = chart
    candleRef.current = candleSeries
    volRef.current    = volSeries

    const ro = new ResizeObserver(() => {
      if (containerRef.current) chart.resize(containerRef.current.clientWidth, 380)
    })
    ro.observe(containerRef.current)

    return () => {
      ro.disconnect()
      chart.remove()
      chartRef.current  = null
      candleRef.current = null
      volRef.current    = null
    }
  }, [color])

  useEffect(() => {
    if (!candleRef.current || !volRef.current || !candles.length) return
    candleRef.current.setData(candles.map(c => ({
      time: c.time as UTCTimestamp, open: c.open, high: c.high, low: c.low, close: c.close,
    })))
    volRef.current.setData(candles.map(c => ({
      time:  c.time as UTCTimestamp,
      value: c.volume,
      color: c.close >= c.open ? '#26a69a55' : '#ef535055',
    })))
    chartRef.current?.timeScale().fitContent()
  }, [candles])

  useEffect(() => {
    if (!candleRef.current || !anomalies.length) return
    createSeriesMarkers(candleRef.current, anomalies.map(a => ({
      time:     a.time as UTCTimestamp,
      position: a.side === 'spike' ? ('aboveBar' as const) : ('belowBar' as const),
      color:    a.side === 'spike' ? '#26a69a' : '#ef5350',
      shape:    a.side === 'spike' ? ('arrowDown' as const) : ('arrowUp' as const),
      text:     `z=${a.zscore}`,
    })))
  }, [anomalies])

  return (
    <div ref={containerRef} className="w-full relative" style={{ height: 380 }}>
      {!candles.length && (
        <div className="absolute inset-0 flex items-center justify-center text-zinc-600 text-sm">
          Loading chart...
        </div>
      )}
    </div>
  )
}
