import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Crypto Dashboard — Real-Time Analytics',
  description: 'Live crypto prices, candlestick charts, volume and anomaly detection powered by Binance WebSocket.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        {children}
      </body>
    </html>
  )
}
