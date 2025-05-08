import type {Metadata} from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { InvoiceDataProvider } from '@/context/invoice-data-context';
import { QuotationProvider } from '@/context/quotation-context'; // Import QuotationProvider

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Invoice Insights',
  description: 'Extract data from Cargomen invoices and compare with quotations.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <InvoiceDataProvider>
          <QuotationProvider> {/* Wrap with QuotationProvider */}
            {children}
          </QuotationProvider>
        </InvoiceDataProvider>
        <Toaster />
      </body>
    </html>
  );
}
