import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '../lib/auth';
import { Nav } from '../components/Nav';

export const metadata: Metadata = {
  title: 'Creditly',
  description: 'Creditly internal platform & banking auction module',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <Nav />
          <main className="mx-auto max-w-5xl p-6">{children}</main>
        </AuthProvider>
      </body>
    </html>
  );
}
