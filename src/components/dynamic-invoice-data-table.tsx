
"use client";

import type { ExtractedData } from '@/types/invoice';
import dynamic from 'next/dynamic';
import React from 'react';

// Dynamically import InvoiceDataTable within a client component
const InvoiceDataTableClient = dynamic(() =>
  import('@/components/invoice-data-table').then((mod) => mod.InvoiceDataTable),
  {
    ssr: false, // Disable server-side rendering for this component
    loading: () => <div className="text-center p-4"><p>Loading data table...</p></div> // Optional loading state
  }
);

interface DynamicInvoiceDataTableProps {
  initialData: ExtractedData[];
}

export function DynamicInvoiceDataTable({ initialData }: DynamicInvoiceDataTableProps) {
  return <InvoiceDataTableClient initialData={initialData} />;
}
