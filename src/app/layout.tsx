import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'wins.im — Spin it. Win it.',
  description: 'The fastest way to pick a winner. Create a wheel, share the link, and spin to win.',
  openGraph: {
    title: 'wins.im — Spin it. Win it.',
    description: 'The fastest way to pick a winner. Create a wheel, share the link, and spin to win.',
    type: 'website',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://api.fontshare.com/v2/css?f[]=clash-display@600,700&f[]=satoshi@400,500,700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased">
        {children}
      </body>
    </html>
  )
}
