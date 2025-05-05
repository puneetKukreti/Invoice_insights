// src/ai/flows/extract-invoice-data.ts
'use server';
/**
 * @fileOverview This file defines a Genkit flow for extracting data from the *first page* of Cargomen invoices.
 *
 * The flow takes an invoice PDF data URI as input, uses AI to extract key fields from the first page,
 * classifies charges (including tax) from the first page by calling another flow, and returns the combined data.
 *
 * @exports extractInvoiceData - A function that extracts invoice data from a PDF data URI (first page only).
 * @exports ExtractInvoiceDataInput - The input type for extractInvoiceData.
 * @exports ExtractInvoiceDataOutput - The output type for extractInvoiceData.
 */

import { ai } from '@/ai/ai-instance';
import { z } from 'genkit';
import { classifyInvoiceCharges, ClassifyInvoiceChargesOutput } from './classify-invoice-charges'; // Import the updated flow

// Define input schema: PDF as a Data URI
const ExtractInvoiceDataInputSchema = z.object({
  invoicePdfDataUri: z
    .string()
    .describe(
      'The invoice PDF file as a data URI that must include a MIME type and use Base64 encoding. Expected format: \'data:application/pdf;base64,<encoded_data>\'.'
    ),
});
export type ExtractInvoiceDataInput = z.infer<typeof ExtractInvoiceDataInputSchema>;

// Define output schema: Combined extracted and classified data (charges now include tax from first page)
const ExtractInvoiceDataOutputSchema = z.object({
  invoiceNumber: z.string().describe('The invoice number (e.g., CCLAIUP252600071) found on the first page.'),
  invoiceDate: z.string().describe('The invoice date (e.g., 29-Apr-2025) found on the first page. Format as YYYY-MM-DD if possible, otherwise use the format found.'),
  hawbNumber: z.string().describe('The primary shipment reference number found on the first page. Prioritize HAWB (House Air Waybill) or HBL (House Bill of Lading). If neither is found, use MAWB (Master Air Waybill) or MBL (Master Bill of Lading). Example: AFRAA0079028.'),
  termsOfInvoice: z.string().describe('The terms of the invoice (e.g., CIF) found on the first page.'),
  jobNumber: z.string().describe('The job number (e.g., IMP/AIR/12771/04/25-26) found on the first page.'),
  cargomenOwnCharges: z.number().describe('The sum of cargomen own charges (including tax) from the first page only.'),
  reimbursementCharges: z.number().describe('The sum of reimbursement charges (including tax) from the first page only.'),
  filename: z.string().optional().describe('The name of the original PDF file.'), // Keep filename optional here
});
export type ExtractInvoiceDataOutput = z.infer<typeof ExtractInvoiceDataOutputSchema>;


// Main function exposed to the application
export async function extractInvoiceData(input: ExtractInvoiceDataInput & { filename?: string }): Promise<ExtractInvoiceDataOutput> {
    const flowOutput = await extractInvoiceDataFlow(input);
    // Ensure filename is passed through if provided in the input
    return {
        ...flowOutput,
        filename: input.filename || flowOutput.filename, // Prioritize input filename
    };
}


// Define the prompt for extracting basic invoice details using the PDF directly
const extractBasicDetailsPrompt = ai.definePrompt({
    name: 'extractBasicDetailsPrompt',
    input: {
        // Input schema expects the PDF data URI
        schema: z.object({
            invoicePdfDataUri: z.string().describe('The invoice PDF data URI.'),
        }),
    },
    output: {
        // Update output schema description for hawbNumber
        schema: z.object({
            invoiceNumber: z.string().describe('The invoice number.'),
            invoiceDate: z.string().describe('The invoice date (YYYY-MM-DD format if possible).'),
            hawbNumber: z.string().describe('The primary shipment reference number (HAWB, HBL, MAWB, or MBL).'),
            termsOfInvoice: z.string().describe('The terms of the invoice (e.g., CIF, Net 30).'),
            jobNumber: z.string().describe('The job number.'),
        }),
    },
    // Update prompt instructions for hawbNumber extraction logic
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


// Define the main Genkit flow
const extractInvoiceDataFlow = ai.defineFlow<ExtractInvoiceDataInputSchema, ExtractInvoiceDataOutputSchema>(
  {
    name: 'extractInvoiceDataFlow',
    inputSchema: ExtractInvoiceDataInputSchema, // Use the schema without filename for the flow itself
    outputSchema: ExtractInvoiceDataOutputSchema,
  },
  async (input) => {
    console.log("Starting invoice data extraction from PDF Data URI (first page only)...");

    // Step 1: Extract Basic Invoice Details using AI directly from the FIRST PAGE of the PDF
    const { output: basicDetails } = await extractBasicDetailsPrompt({
        invoicePdfDataUri: input.invoicePdfDataUri, // Pass the data URI
    });

    if (!basicDetails) {
        throw new Error("Failed to extract basic details from the first page of the invoice document.");
    }
    console.log("Basic details extracted (first page):", basicDetails);

    // Step 2: Classify Charges (including tax) using the classifyInvoiceCharges AI flow (which also works on the first page)
    console.log("Classifying charges (incl. tax, first page only)...");
    const charges: ClassifyInvoiceChargesOutput = await classifyInvoiceCharges({
        invoicePdfDataUri: input.invoicePdfDataUri, // Pass the data URI
    });
    console.log("Charges classified (incl. tax, first page only):", charges);


    // Step 3: Combine results and return (filename will be added in the wrapper function)
    const combinedOutput = {
      invoiceNumber: basicDetails.invoiceNumber,
      invoiceDate: basicDetails.invoiceDate,
      hawbNumber: basicDetails.hawbNumber, // This now contains HAWB/HBL or MAWB/MBL
      termsOfInvoice: basicDetails.termsOfInvoice,
      jobNumber: basicDetails.jobNumber,
      cargomenOwnCharges: charges.cargomenOwnCharges, // Now includes tax (first page)
      reimbursementCharges: charges.reimbursementCharges, // Now includes tax (first page)
      // filename is not included here, will be added by the calling function if provided
    };

    console.log("Combined extraction output (charges incl. tax, first page only):", combinedOutput);
    return combinedOutput;
  }
);
