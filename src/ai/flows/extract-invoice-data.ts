// src/ai/flows/extract-invoice-data.ts
'use server';
/**
 * @fileOverview This file defines a Genkit flow for extracting data from the *first page* of Cargomen invoices.
 *
 * The flow takes an invoice PDF data URI as input, uses AI to extract key fields from the first page,
 * classifies charges (including tax and broken down individual own charges) from the first page by calling another flow,
 * and returns the combined data.
 *
 * @exports extractInvoiceData - A function that extracts invoice data from a PDF data URI (first page only).
 * @exports ExtractInvoiceDataInput - The input type for extractInvoiceData.
 * @exports ExtractInvoiceDataOutput - The output type for extractInvoiceData.
 */

import { ai } from '@/ai/ai-instance';
import { z } from 'genkit';
import { classifyInvoiceCharges, ClassifyInvoiceChargesOutput } from './classify-invoice-charges';

const ExtractInvoiceDataInputSchema = z.object({
  invoicePdfDataUri: z
    .string()
    .describe(
      'The invoice PDF file as a data URI that must include a MIME type and use Base64 encoding. Expected format: \'data:application/pdf;base64,<encoded_data>\'.'
    ),
});
export type ExtractInvoiceDataInput = z.infer<typeof ExtractInvoiceDataInputSchema>;

const ExtractInvoiceDataOutputSchema = z.object({
  invoiceNumber: z.string().describe('The invoice number (e.g., CCLAIUP252600071) found on the first page.'),
  invoiceDate: z.string().describe('The invoice date (e.g., 29-Apr-2025) found on the first page. Format as YYYY-MM-DD if possible, otherwise use the format found.'),
  hawbNumber: z.string().describe('The primary shipment reference number found on the first page. Prioritize HAWB (House Air Waybill) or HBL (House Bill of Lading). If neither is found, use MAWB (Master Air Waybill) or MBL (Master Bill of Lading). Example: AFRAA0079028.'),
  termsOfInvoice: z.string().describe('The terms of the invoice (e.g., CIF) found on the first page.'),
  jobNumber: z.string().describe('The job number (e.g., IMP/AIR/12771/04/25-26) found on the first page.'),
  serviceCharges: z.number().describe('The sum of "SERVICE CHARGES" or "AGENCY SERVICE CHARGES" (including tax from "Total (INR)" column) from the first page only.'),
  loadingUnloadingCharges: z.number().describe('The sum of "LOADING & UNLOADING CHARGES" (including tax from "Total (INR)" column) from the first page only.'),
  transportationCharges: z.number().describe('The sum of "TRANSPORTATION" or "CARTAGE CHARGES" (including tax from "Total (INR)" column) from the first page only.'),
  reimbursementCharges: z.number().describe('The sum of all other reimbursement charges (including tax from "Total (INR)" column) from the first page only.'),
  filename: z.string().optional().describe('The name of the original PDF file.'),
});
export type ExtractInvoiceDataOutput = z.infer<typeof ExtractInvoiceDataOutputSchema>;


export async function extractInvoiceData(input: ExtractInvoiceDataInput & { filename?: string }): Promise<ExtractInvoiceDataOutput> {
    const flowOutput = await extractInvoiceDataFlow(input);
    return {
        ...flowOutput,
        filename: input.filename || flowOutput.filename,
    };
}

const extractBasicDetailsPrompt = ai.definePrompt({
    name: 'extractBasicDetailsPrompt',
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
        }),
    },
    prompt: `You are an expert invoice data extractor specializing in Cargomen invoices. Analyze **ONLY THE FIRST PAGE** of the following invoice document and extract the specified fields accurately. Ignore all subsequent pages.

    Invoice Document (Analyze First Page Only):
    {{media url=invoicePdfDataUri maxPages=1}}

    Extract the following fields from the first page and return them as a JSON object:
    - invoiceNumber: The main invoice number (e.g., CCLAIUP252600071)
    - invoiceDate: The date the invoice was issued (e.g., 29-Apr-2025). Format as YYYY-MM-DD if possible, otherwise use the exact format found.
    - hawbNumber: The primary shipment reference number. **Search for HAWB (House Air Waybill) or HBL (House Bill of Lading) first.** If you find either, use that value. **If neither HAWB nor HBL is present, then search for MAWB (Master Air Waybill) or MBL (Master Bill of Lading) and use that value.** Use only one number. (e.g., AFRAA0079028). If none of these (HAWB, HBL, MAWB, MBL) are found, return an empty string "".
    - termsOfInvoice: The payment or delivery terms (e.g., CIF).
    - jobNumber: The specific job identifier (e.g., IMP/AIR/12771/04/25-26).
    `,
});

const extractInvoiceDataFlow = ai.defineFlow<ExtractInvoiceDataInputSchema, ExtractInvoiceDataOutputSchema>(
  {
    name: 'extractInvoiceDataFlow',
    inputSchema: ExtractInvoiceDataInputSchema,
    outputSchema: ExtractInvoiceDataOutputSchema,
  },
  async (input) => {
    console.log("Starting invoice data extraction from PDF Data URI (first page only)...");

    const { output: basicDetails } = await extractBasicDetailsPrompt({
        invoicePdfDataUri: input.invoicePdfDataUri,
    });

    if (!basicDetails) {
        throw new Error("Failed to extract basic details from the first page of the invoice document.");
    }
    console.log("Basic details extracted (first page):", basicDetails);

    console.log("Classifying charges (incl. tax, first page only, individual own charges)...");
    const charges: ClassifyInvoiceChargesOutput = await classifyInvoiceCharges({
        invoicePdfDataUri: input.invoicePdfDataUri,
    });
    console.log("Charges classified (incl. tax, first page only, individual own charges):", charges);

    const combinedOutput = {
      invoiceNumber: basicDetails.invoiceNumber,
      invoiceDate: basicDetails.invoiceDate,
      hawbNumber: basicDetails.hawbNumber,
      termsOfInvoice: basicDetails.termsOfInvoice,
      jobNumber: basicDetails.jobNumber,
      serviceCharges: charges.serviceCharges,
      loadingUnloadingCharges: charges.loadingUnloadingCharges,
      transportationCharges: charges.transportationCharges,
      reimbursementCharges: charges.reimbursementCharges,
    };

    console.log("Combined extraction output (individual own charges incl. tax, first page only):", combinedOutput);
    return combinedOutput;
  }
);
