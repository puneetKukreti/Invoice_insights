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
  filename?: string; // Optional filename property
}

```