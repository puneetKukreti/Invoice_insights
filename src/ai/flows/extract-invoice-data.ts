// src/ai/flows/extract-invoice-data.ts
'use server';
/**
 * @fileOverview This file defines a Genkit flow for extracting data from the *first page* of Cargomen invoices.
 *
 * The flow takes an invoice PDF data URI as input, uses AI to extract key fields from the first page,
 * classifies charges (including tax and individual actuals) from the first page by calling another flow,
 * determines shipment type, and returns the combined data.
 *
 * @exports extractInvoiceData - A function that extracts invoice data from a PDF data URI (first page only).
 * @exports ExtractInvoiceDataInput - The input type for extractInvoiceData.
 * @exports ExtractInvoiceDataOutput - The output type for extractInvoiceData.
 */

import { ai } from '@/ai/ai-instance';
import { z } from 'genkit';
import { classifyInvoiceCharges, ClassifyInvoiceChargesOutput } from './classify-invoice-charges';
import type { ExtractedData } from '@/types/invoice'; // For type hint

const ExtractInvoiceDataInputSchema = z.object({
  invoicePdfDataUri: z
    .string()
    .describe(
      'The invoice PDF file as a data URI. Expected format: \'data:application/pdf;base64,<encoded_data>\'.'
    ),
});
export type ExtractInvoiceDataInput = z.infer<typeof ExtractInvoiceDataInputSchema>;

// Define output schema: Includes new fields from ExtractedData in types/invoice.ts
const ExtractInvoiceDataOutputSchema = z.object({
  invoiceNumber: z.string().describe('The invoice number (e.g., CCLAIUP252600071) found on the first page.'),
  invoiceDate: z.string().describe('The invoice date (e.g., 29-Apr-2025) found on the first page. Format as YYYY-MM-DD if possible, otherwise use the format found.'),
  hawbNumber: z.string().describe('The primary shipment reference number found on the first page. Prioritize HAWB or HBL. If neither, use MAWB or MBL. Example: AFRAA0079028.'),
  termsOfInvoice: z.string().describe('The terms of the invoice (e.g., CIF) found on the first page.'),
  jobNumber: z.string().describe('The job number (e.g., IMP/AIR/12771/04/25-26) found on the first page.'),
  
  serviceChargesActual: z.number().optional().default(0).describe("Actual 'Total (INR)' for Service Charges from invoice first page."),
  loadingChargesActual: z.number().optional().default(0).describe("Actual 'Total (INR)' for Loading & Unloading Charges from invoice first page."),
  transportationChargesActual: z.number().optional().default(0).describe("Actual 'Total (INR)' for Transportation charges from invoice first page."),
  
  cargomenOwnCharges: z.number().describe('The sum of cargomen own charges (including tax) from the first page only.'),
  reimbursementCharges: z.number().describe('The sum of reimbursement charges (including tax) from the first page only.'),
  
  shipmentType: z.enum(['air', 'ocean', 'unknown']).describe("Determined shipment type ('air', 'ocean', or 'unknown') based on invoice content like job number or keywords.").default('unknown'),
  filename: z.string().optional().describe('The name of the original PDF file.'),
  // comparisonStatus will be calculated in the UI component
});
export type ExtractInvoiceDataOutput = z.infer<typeof ExtractInvoiceDataOutputSchema>;


export async function extractInvoiceData(input: ExtractInvoiceDataInput & { filename?: string }): Promise<ExtractInvoiceDataOutput> {
    const flowOutput = await extractInvoiceDataFlow(input);
    return {
        ...flowOutput,
        filename: input.filename || flowOutput.filename,
    };
}

const extractBasicDetailsAndShipmentTypePrompt = ai.definePrompt({
    name: 'extractBasicDetailsAndShipmentTypePrompt',
    input: {
        schema: z.object({
            invoicePdfDataUri: z.string().describe('The invoice PDF data URI.'),
        }),
    },
    output: {
        schema: z.object({
            invoiceNumber: z.string().describe('The invoice number.'),
            invoiceDate: z.string().describe('The invoice date (YYYY-MM-DD format if possible).'),
            hawbNumber: z.string().describe('The primary shipment reference number (HAWB, HBL, MAWB, or MBL).'),
            termsOfInvoice: z.string().describe('The terms of the invoice (e.g., CIF, Net 30).'),
            jobNumber: z.string().describe('The job number.'),
            shipmentType: z.enum(['air', 'ocean', 'unknown']).describe("The shipment type. Infer 'air' if job number contains 'AIR', 'IMP/AIR', 'EXP/AIR' or if HAWB/MAWB is present and prominent. Infer 'ocean' if job number contains 'SEA', 'IMP/SEA', 'EXP/SEA' or if HBL/MBL is present and prominent. Otherwise 'unknown'.").default('unknown'),
        }),
    },
    prompt: `You are an expert invoice data extractor specializing in Cargomen invoices. Analyze **ONLY THE FIRST PAGE** of the following invoice document and extract the specified fields accurately.

    Invoice Document (Analyze First Page Only):
    {{media url=invoicePdfDataUri maxPages=1}}

    Extract the following fields from the first page:
    - invoiceNumber
    - invoiceDate (Format as YYYY-MM-DD if possible)
    - hawbNumber: Primary shipment ref. Search HAWB/HBL first. If none, use MAWB/MBL. If none, return empty string "".
    - termsOfInvoice
    - jobNumber
    - shipmentType: Infer shipment type.
        - If jobNumber contains 'AIR', 'IMP/AIR', 'EXP/AIR', or if terms like 'Air Waybill', 'HAWB', 'MAWB' are clearly associated with the main shipment, set to 'air'.
        - If jobNumber contains 'SEA', 'IMP/SEA', 'EXP/SEA', or if terms like 'Bill of Lading', 'HBL', 'MBL', 'Ocean Freight' are clearly associated, set to 'ocean'.
        - Otherwise, set to 'unknown'.

    Return as JSON.`,
});

const extractInvoiceDataFlow = ai.defineFlow<ExtractInvoiceDataInputSchema, ExtractInvoiceDataOutputSchema>(
  {
    name: 'extractInvoiceDataFlow',
    inputSchema: ExtractInvoiceDataInputSchema,
    outputSchema: ExtractInvoiceDataOutputSchema,
  },
  async (input) => {
    console.log("Starting invoice data extraction (first page only)...");

    const { output: basicDetailsAndType } = await extractBasicDetailsAndShipmentTypePrompt({
        invoicePdfDataUri: input.invoicePdfDataUri,
    });

    if (!basicDetailsAndType) {
        throw new Error("Failed to extract basic details and shipment type from the invoice.");
    }
    console.log("Basic details & shipment type extracted:", basicDetailsAndType);

    console.log("Classifying charges (incl. actuals for specific items, first page only)...");
    const charges: ClassifyInvoiceChargesOutput = await classifyInvoiceCharges({
        invoicePdfDataUri: input.invoicePdfDataUri,
    });
    console.log("Charges classified (incl. actuals, first page only):", charges);

    const combinedOutput: Omit<ExtractInvoiceDataOutput, 'filename' | 'comparisonStatus'> = {
      invoiceNumber: basicDetailsAndType.invoiceNumber,
      invoiceDate: basicDetailsAndType.invoiceDate,
      hawbNumber: basicDetailsAndType.hawbNumber,
      termsOfInvoice: basicDetailsAndType.termsOfInvoice,
      jobNumber: basicDetailsAndType.jobNumber,
      shipmentType: basicDetailsAndType.shipmentType as 'air' | 'ocean' | 'unknown',
      
      serviceChargesActual: charges.serviceChargesActual,
      loadingChargesActual: charges.loadingChargesActual,
      transportationChargesActual: charges.transportationChargesActual,
      
      cargomenOwnCharges: charges.cargomenOwnCharges,
      reimbursementCharges: charges.reimbursementCharges,
    };

    console.log("Combined extraction output:", combinedOutput);
    return combinedOutput as ExtractInvoiceDataOutput; // Cast, filename added by wrapper
  }
);
