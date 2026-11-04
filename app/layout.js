export const metadata = { title: 'FreshFlow' };

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif', background: '#f6f7f4', color: '#1d2a22' }}>
        {children}
      </body>
    </html>
  );
}
