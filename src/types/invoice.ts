// src/types/invoice.ts

/**
 * Represents the data extracted from a single invoice.
 */
export interface ExtractedData {
  /** The date the invoice was issued. */
  invoiceDate: string;
  /** The unique identifier for the invoice. */
  invoiceNumber: string;
  /** The primary shipment reference number (HAWB, HBL, MAWB, or MBL). */
  hawbNumber: string;
  /** The payment terms specified on the invoice. */
  termsOfInvoice: string;
  /** The job or project number related to the invoice. */
  jobNumber: string;
  /** The calculated sum of charges (including tax) directly related to Cargomen's services. */
  cargomenOwnCharges: number;
  /** The calculated sum of charges (including tax) paid to third parties and reimbursed by the customer. */
  reimbursementCharges: number;
  /** The name of the original PDF file from which the data was extracted. */
  filename?: string;

  // Fields for quotation comparison
  /** Actual service charges total from the invoice's 'Total (INR)' column. */
  serviceChargesActual?: number;
  /** Actual loading/unloading charges total from the invoice's 'Total (INR)' column. */
  loadingChargesActual?: number;
  /** Actual transportation charges total from the invoice's 'Total (INR)' column. */
  transportationChargesActual?: number;
  /** Determined shipment type of the invoice. */
  shipmentType?: 'air' | 'ocean' | 'unknown';
  /** Status of comparison with quotation. */
  comparisonStatus?: 'matched' | 'mismatched' | 'no_quotation_data' | 'invoice_type_unknown' | 'not_comparable_charges';
}

/**
 * Represents the rates extracted from a quotation PDF.
 */
export interface QuotationRates {
  airServiceChargeRate?: number;
  airServiceChargeDescription?: string;
  airLoadingChargeRate?: number;
  airLoadingChargeDescription?: string;
  airTransportationChargeRate?: number; // Added for completeness
  airTransportationChargeDescription?: string; // Added for completeness

  oceanServiceChargeRate?: number;
  oceanServiceChargeDescription?: string;
  oceanLoadingChargeRate?: number;
  oceanLoadingChargeDescription?: string;
  oceanTransportationChargeRate?: number; // Added for completeness
  oceanTransportationChargeDescription?: string; // Added for completeness
}
