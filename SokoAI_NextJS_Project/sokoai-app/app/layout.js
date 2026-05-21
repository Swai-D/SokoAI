import './globals.css';

export const metadata = {
  title: 'SokoAI — Market Price Prediction System',
  description: 'AI-powered market price forecasting for Tanzanian small-scale traders',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
