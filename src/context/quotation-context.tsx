"use client";

import type { ReactNode } from 'react';
import React, { createContext, useState, useContext, useCallback } from 'react';
import type { QuotationRates } from '@/types/invoice';

interface QuotationContextType {
  quotationRates: QuotationRates | null;
  setQuotationRates: (rates: QuotationRates | null) => void;
  clearQuotationRates: () => void;
}

const QuotationContext = createContext<QuotationContextType | undefined>(undefined);

export const QuotationProvider = ({ children }: { children: ReactNode }) => {
  const [quotationRates, setQuotationRatesState] = useState<QuotationRates | null>(null);

  const setQuotationRates = useCallback((rates: QuotationRates | null) => {
    setQuotationRatesState(rates);
  }, []);

  const clearQuotationRates = useCallback(() => {
    setQuotationRatesState(null);
  }, []);

  return (
    <QuotationContext.Provider value={{ quotationRates, setQuotationRates, clearQuotationRates }}>
      {children}
    </QuotationContext.Provider>
  );
};

export const useQuotation = () => {
  const context = useContext(QuotationContext);
  if (context === undefined) {
    throw new Error('useQuotation must be used within a QuotationProvider');
  }
  return context;
};
