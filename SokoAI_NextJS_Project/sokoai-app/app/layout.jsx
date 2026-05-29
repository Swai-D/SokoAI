import './globals.css';
import { AuthProvider } from '@/lib/auth';
import NavbarWithAuth from '@/components/NavbarWithAuth';

export const metadata = {
  title: 'SokoAI — Bei za Masoko Tanzania',
  description: 'Mfumo wa AI wa kufuatilia bei za bidhaa za chakula Tanzania',
};

export default function RootLayout({ children }) {
  return (
    <html lang="sw">
      <body>
        <AuthProvider>
          <NavbarWithAuth />
          <main>{children}</main>
        </AuthProvider>
      </body>
    </html>
  );
}
