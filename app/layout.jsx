export const metadata = {
  title: 'BiTemporal Datemodel Viewer',
  description: 'Front-end only bitemporal viewer',
}

import './globals.css'

export default function RootLayout({ children }) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  )
}

