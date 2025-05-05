// src/ai/flows/extract-invoice-data.ts
'use server';
/**
 * @fileOverview This file defines a Genkit flow for extracting data from Cargomen invoices.
 *
 * The flow takes an invoice PDF data URI as input, uses AI to extract key fields,
 * classifies charges (including tax) by calling another flow, and returns the combined data.
 *
 * @exports extractInvoiceData - A function that extracts invoice data from a PDF data URI.
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

// Define output schema: Combined extracted and classified data (charges now include tax)
const ExtractInvoiceDataOutputSchema = z.object({
  invoiceNumber: z.string().describe('The invoice number (e.g., CCLAIUP252600071).'),
  invoiceDate: z.string().describe('The invoice date (e.g., 29-Apr-2025). Format as YYYY-MM-DD if possible, otherwise use the format found.'),
  hawbNumber: z.string().describe('The HAWB number (e.g., AFRAA0079028).'),
  termsOfInvoice: z.string().describe('The terms of the invoice (e.g., CIF).'),
  jobNumber: z.string().describe('The job number (e.g., IMP/AIR/12771/04/25-26).'),
  cargomenOwnCharges: z.number().describe('The sum of cargomen own charges, including applicable tax for each line item.'),
  reimbursementCharges: z.number().describe('The sum of reimbursement charges, including applicable tax for each line item.'),
});
export type ExtractInvoiceDataOutput = z.infer<typeof ExtractInvoiceDataOutputSchema>;

// Main function exposed to the application
export async function extractInvoiceData(input: ExtractInvoiceDataInput): Promise<ExtractInvoiceDataOutput> {
  return extractInvoiceDataFlow(input);
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
        schema: z.object({
            invoiceNumber: z.string().describe('The invoice number.'),
            invoiceDate: z.string().describe('The invoice date (YYYY-MM-DD format if possible).'),
            hawbNumber: z.string().describe('The HAWB number.'),
            termsOfInvoice: z.string().describe('The terms of the invoice (e.g., CIF, Net 30).'),
            jobNumber: z.string().describe('The job number.'),
        }),
    },
    // Prompt now directly references the media (PDF)
    prompt: `You are an expert invoice data extractor specializing in Cargomen invoices. Analyze the following invoice document and extract the specified fields accurately.

    Invoice Document:
    {{media url=invoicePdfDataUri}}

    Extract the following fields and return them as a JSON object:
    - invoiceNumber: The main invoice number (e.g., CCLAIUP252600071)
    - invoiceDate: The date the invoice was issued (e.g., 29-Apr-2025). Format as YYYY-MM-DD if possible, otherwise use the exact format found.
    - hawbNumber: The House Air Waybill number (e.g., AFRAA0079028).
    - termsOfInvoice: The payment or delivery terms (e.g., CIF).
    - jobNumber: The specific job identifier (e.g., IMP/AIR/12771/04/25-26).
    `,
});


// Define the main Genkit flow
const extractInvoiceDataFlow = ai.defineFlow<ExtractInvoiceDataInputSchema, ExtractInvoiceDataOutputSchema>(
  {
    name: 'extractInvoiceDataFlow',
    inputSchema: ExtractInvoiceDataInputSchema,
    outputSchema: ExtractInvoiceDataOutputSchema,
  },
  async (input) => {
    console.log("Starting invoice data extraction from PDF Data URI...");

    // Step 1: Extract Basic Invoice Details using AI directly from the PDF
    const { output: basicDetails } = await extractBasicDetailsPrompt({
        invoicePdfDataUri: input.invoicePdfDataUri, // Pass the data URI
    });

    if (!basicDetails) {
        throw new Error("Failed to extract basic details from invoice document.");
    }
    console.log("Basic details extracted:", basicDetails);

    // Step 2: Classify Charges (including tax) using the classifyInvoiceCharges AI flow
    console.log("Classifying charges (incl. tax)...");
    const charges: ClassifyInvoiceChargesOutput = await classifyInvoiceCharges({
        invoicePdfDataUri: input.invoicePdfDataUri, // Pass the data URI
    });
    console.log("Charges classified (incl. tax):", charges);


    // Step 3: Combine results and return
    const combinedOutput = {
      invoiceNumber: basicDetails.invoiceNumber,
      invoiceDate: basicDetails.invoiceDate,
      hawbNumber: basicDetails.hawbNumber,
      termsOfInvoice: basicDetails.termsOfInvoice,
      jobNumber: basicDetails.jobNumber,
      cargomenOwnCharges: charges.cargomenOwnCharges, // Now includes tax
      reimbursementCharges: charges.reimbursementCharges, // Now includes tax
    };

    console.log("Combined extraction output (charges incl. tax):", combinedOutput);
    return combinedOutput;
  }
);
