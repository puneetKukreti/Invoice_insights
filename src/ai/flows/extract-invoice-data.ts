// src/ai/flows/extract-invoice-data.ts
'use server';
/**
 * @fileOverview This file defines a Genkit flow for extracting data from Cargomen invoices.
 *
 * The flow takes an invoice PDF data URI as input, simulates text extraction,
 * uses AI to extract key fields, classifies charges, and returns the combined data.
 *
 * @exports extractInvoiceData - A function that extracts invoice data from a PDF data URI.
 * @exports ExtractInvoiceDataInput - The input type for extractInvoiceData.
 * @exports ExtractInvoiceDataOutput - The output type for extractInvoiceData.
 */

import { ai } from '@/ai/ai-instance';
import { z } from 'genkit';
import { classifyInvoiceCharges, ClassifyInvoiceChargesOutput } from './classify-invoice-charges'; // Import the actual flow

// Define input schema: PDF as a Data URI
const ExtractInvoiceDataInputSchema = z.object({
  invoicePdfDataUri: z
    .string()
    .describe(
      'The invoice PDF file as a data URI that must include a MIME type and use Base64 encoding. Expected format: \'data:<mimetype>;base64,<encoded_data>\'.'
    ),
});
export type ExtractInvoiceDataInput = z.infer<typeof ExtractInvoiceDataInputSchema>;

// Define output schema: Combined extracted and classified data
const ExtractInvoiceDataOutputSchema = z.object({
  invoiceNumber: z.string().describe('The invoice number.'),
  invoiceDate: z.string().describe('The invoice date.'),
  hawbNumber: z.string().describe('The HAWB number.'),
  termsOfInvoice: z.string().describe('The terms of the invoice.'),
  jobNumber: z.string().describe('The job number.'),
  cargomenOwnCharges: z.number().describe('The sum of cargomen own charges.'),
  reimbursementCharges: z.number().describe('The sum of reimbursement charges.'),
});
export type ExtractInvoiceDataOutput = z.infer<typeof ExtractInvoiceDataOutputSchema>;

// Main function exposed to the application
export async function extractInvoiceData(input: ExtractInvoiceDataInput): Promise<ExtractInvoiceDataOutput> {
  return extractInvoiceDataFlow(input);
}

// Define the prompt for extracting basic invoice details
const extractBasicDetailsPrompt = ai.definePrompt({
    name: 'extractBasicDetailsPrompt',
    input: {
        schema: z.object({
            invoiceText: z.string().describe('The full text content of the invoice.'),
        }),
    },
    output: {
        schema: z.object({
            invoiceNumber: z.string().describe('The invoice number.'),
            invoiceDate: z.string().describe('The invoice date (YYYY-MM-DD format if possible).'),
            hawbNumber: z.string().describe('The HAWB number.'),
            termsOfInvoice: z.string().describe('The terms of the invoice (e.g., Net 30).'),
            jobNumber: z.string().describe('The job number.'),
        }),
    },
    prompt: `You are an expert invoice data extractor. Analyze the following invoice text and extract the specified fields. Correct any OCR noise before extraction.

    Invoice Text:
    {{invoiceText}}

    Extract the following fields and return them as a JSON object:
    - invoiceNumber
    - invoiceDate (Format as YYYY-MM-DD if possible, otherwise use the format found)
    - hawbNumber
    - termsOfInvoice
    - jobNumber
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
    // Step 1: Simulate Text Extraction from PDF Data URI
    // In a real application, use a library like 'pdf-parse' (server-side)
    // or integrate with a cloud service (like Google Document AI)
    // For now, we'll use a placeholder. The quality of this step is crucial.
    console.log("Simulating text extraction from PDF Data URI...");
    // Decode base64 (basic simulation - doesn't actually parse PDF content)
    let simulatedText = "Placeholder: Extracted text from PDF would go here. INV-001, 2024-01-01, HAWB-001, Net 30, JOB-001. Service Charge: 100, Reimbursement Custodian: 50.";
    try {
        const base64Data = input.invoicePdfDataUri.split(',')[1];
        if (base64Data) {
             // This is NOT real PDF text extraction. Just decoding to show processing.
             // simulatedText = Buffer.from(base64Data, 'base64').toString('utf-8');
             // Using a fixed placeholder because direct decoding is not meaningful for PDF structure.
             console.log("Using placeholder text for AI processing.");
        }
    } catch (e) {
        console.error("Failed to decode base64 data URI (basic check):", e);
        // Keep using the placeholder if decoding fails
    }


    // Step 2: Extract Basic Invoice Details using AI
    const { output: basicDetails } = await extractBasicDetailsPrompt({
        invoiceText: simulatedText, // Use the (simulated) extracted text
    });

    if (!basicDetails) {
        throw new Error("Failed to extract basic details from invoice text.");
    }

    // Step 3: Classify Charges using the classifyInvoiceCharges AI flow
    // The classify flow expects the invoice object and text.
    const chargesInput = {
      // Pass the details extracted in the previous step
      invoice: {
        invoiceDate: basicDetails.invoiceDate,
        invoiceNumber: basicDetails.invoiceNumber,
        hawbNumber: basicDetails.hawbNumber,
        termsOfInvoice: basicDetails.termsOfInvoice,
        jobNumber: basicDetails.jobNumber,
      },
      invoiceText: simulatedText, // Pass the same (simulated) text
    };
    const charges: ClassifyInvoiceChargesOutput = await classifyInvoiceCharges(chargesInput);

    // Step 4: Combine results and return
    return {
      invoiceNumber: basicDetails.invoiceNumber,
      invoiceDate: basicDetails.invoiceDate,
      hawbNumber: basicDetails.hawbNumber,
      termsOfInvoice: basicDetails.termsOfInvoice,
      jobNumber: basicDetails.jobNumber,
      cargomenOwnCharges: charges.cargomenOwnCharges,
      reimbursementCharges: charges.reimbursementCharges,
    };
  }
);
