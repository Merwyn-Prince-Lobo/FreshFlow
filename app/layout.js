import './globals.css';

export const metadata = {
  title: 'FreshFlow | Smart Inventory',
  description: 'Smart perishable inventory management',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}