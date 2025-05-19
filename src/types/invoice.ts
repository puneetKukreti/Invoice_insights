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
  /** The sum of "Total (INR)" values for "SERVICE CHARGES" or "AGENCY SERVICE CHARGES" from the first page. */
  serviceCharges: number;
  /** The sum of "Total (INR)" values for "LOADING & UNLOADING CHARGES" from the first page. */
  loadingUnloadingCharges: number;
  /** The sum of "Total (INR)" values for "TRANSPORTATION" or "CARTAGE CHARGES" from the first page. */
  transportationCharges: number;
  /** The calculated sum of charges (including tax) paid to third parties and reimbursed by the customer, excluding the specific own charges. */
  reimbursementCharges: number;
  /** The name of the original PDF file from which the data was extracted. */
  filename?: string; // Optional filename property
}
