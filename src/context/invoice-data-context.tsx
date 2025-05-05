"use client";

import React, { createContext, useState, useContext, ReactNode, useCallback } from 'react';
import type { ExtractedData } from '@/types/invoice';

interface InvoiceDataContextType {
  invoiceData: ExtractedData[];
  addInvoiceData: (newData: ExtractedData | ExtractedData[]) => void;
  clearInvoiceData: () => void;
}

const InvoiceDataContext = createContext<InvoiceDataContextType | undefined>(undefined);

export const InvoiceDataProvider = ({ children }: { children: ReactNode }) => {
  const [invoiceData, setInvoiceData] = useState<ExtractedData[]>([]);

  const addInvoiceData = useCallback((newData: ExtractedData | ExtractedData[]) => {
    setInvoiceData((prevData) => {
      const dataToAdd = Array.isArray(newData) ? newData : [newData];
      // Basic check to prevent adding duplicates based on invoice number AND filename
      const uniqueNewData = dataToAdd.filter(newItem =>
        !prevData.some(existingItem =>
          existingItem.invoiceNumber === newItem.invoiceNumber && existingItem.filename === newItem.filename
        )
      );
      return [...prevData, ...uniqueNewData];
    });
  }, []);


  const clearInvoiceData = useCallback(() => {
    setInvoiceData([]);
  }, []);

  return (
    <InvoiceDataContext.Provider value={{ invoiceData, addInvoiceData, clearInvoiceData }}>
      {children}
    </InvoiceDataContext.Provider>
  );
};

export const useInvoiceData = () => {
  const context = useContext(InvoiceDataContext);
  if (context === undefined) {
    throw new Error('useInvoiceData must be used within an InvoiceDataProvider');
  }
  return context;
};
