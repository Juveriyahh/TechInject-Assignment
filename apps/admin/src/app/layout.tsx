import type { Metadata } from 'next';
import '@tech-inject/ui/styles.css';

export const metadata: Metadata = {
  title: 'Tech Inject — Admin',
  description: 'Publish and manage the Tech Inject Design Library.',
  robots: { index: false, follow: false }
};

export default function RootLayout({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-background font-sans text-base text-foreground">{children}</body>
    </html>
  );
}
