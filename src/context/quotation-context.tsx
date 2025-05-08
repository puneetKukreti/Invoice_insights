"use client";

import type { ReactNode } from 'react';
import React, { createContext, useContext } from 'react';
import type { QuotationRates } from '@/types/invoice';

// Hardcoded quotation rates based on the provided screenshot
const hardcodedQuotationRates: QuotationRates = {
  airServiceChargeRate: 4000,
  airServiceChargeDescription: "0.12% Of Assessable value or Subject to Min. Rs.4000/- per BOE",
  airLoadingChargeRate: 200,
  airLoadingChargeDescription: "Rs. 0.50 per Kg Sub. to a Min of Rs. 200. Unloading Charges at Site: At actual as per receipt.", // Combined descriptions
  airTransportationChargeRate: 3500, 
  airTransportationChargeDescription: "Air Import Shipments - Airport to Factory Site (Within Delhi): Load Limit 800Kg (CBV - Tata ACE) Lose Packing 3500 INR, Load Limit 3 MTS / 14Ft (CBT-EICHER) Lose Packing 5400 INR, Load Limit 5 MTS / 17 Ft (CBT-EICHER) Lose Packing 6500 INR",

  oceanServiceChargeRate: 4500,
  oceanServiceChargeDescription: "0.12% of Assessable value or Sub. to Min. Rs.4500 per BOE For LCL Shipment & Rs.6500 per Container",
  oceanLoadingChargeRate: 500,
  oceanLoadingChargeDescription: "Loading/Unloading Charges at Port: Rs.0.50 per kg Subject to Min Rs.500 per shipment",
  oceanTransportationChargeRate: 4000,
  oceanTransportationChargeDescription: "LCL Sea Shipments - CFS to Factory Site (Within Delhi): Load Limit 800Kg (CBV - Tata ACE) Lose Packing 4000 INR, Load Limit 3 MTS / 14Ft (CBT-EICHER) Lose Packing 5500 INR, Load Limit 5 MTS / 17 Ft (CBT-EICHER) Lose Packing 6500 INR, 20ft CONTAINER 12000 INR, 40ft Container 13000 INR",
};

interface QuotationContextType {
  quotationRates: QuotationRates | null;
}

const QuotationContext = createContext<QuotationContextType | undefined>(undefined);

export const QuotationProvider = ({ children }: { children: ReactNode }) => {
  // Quotation rates are now hardcoded and provided directly
  const quotationRates = hardcodedQuotationRates;

  return (
    <QuotationContext.Provider value={{ quotationRates }}>
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
