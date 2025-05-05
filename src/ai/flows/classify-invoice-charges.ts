// src/ai/flows/classify-invoice-charges.ts
'use server';

/**
 * @fileOverview Classifies invoice charges into 'Cargomen Own Charges' and 'Reimbursement Charges' directly from an invoice PDF.
 *
 * - classifyInvoiceCharges - A function that classifies invoice charges from a PDF data URI.
 * - ClassifyInvoiceChargesInput - The input type for the classifyInvoiceCharges function.
 * - ClassifyInvoiceChargesOutput - The return type for the classifyInvoiceCharges function.
 */

import {ai} from '@/ai/ai-instance';
import {z} from 'genkit';

// Input schema now expects the PDF data URI
const ClassifyInvoiceChargesInputSchema = z.object({
  invoicePdfDataUri: z
    .string()
    .describe(
      "The invoice PDF file as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:application/pdf;base64,<encoded_data>'."
    ),
});
export type ClassifyInvoiceChargesInput = z.infer<typeof ClassifyInvoiceChargesInputSchema>;

const ClassifyInvoiceChargesOutputSchema = z.object({
  cargomenOwnCharges: z.number().describe('The sum of Cargomen own charges.'),
  reimbursementCharges: z.number().describe('The sum of reimbursement charges.'),
});
export type ClassifyInvoiceChargesOutput = z.infer<typeof ClassifyInvoiceChargesOutputSchema>;

export async function classifyInvoiceCharges(
  input: ClassifyInvoiceChargesInput
): Promise<ClassifyInvoiceChargesOutput> {
  return classifyInvoiceChargesFlow(input);
}

const classifyInvoiceChargesPrompt = ai.definePrompt({
  name: 'classifyInvoiceChargesPrompt',
  input: {
    // Input schema expects the PDF data URI
    schema: ClassifyInvoiceChargesInputSchema,
  },
  output: {
    schema: ClassifyInvoiceChargesOutputSchema,
  },
  // Prompt now directly references the media (PDF)
  prompt: `You are an expert in invoice processing for Cargomen. Your task is to analyze the provided invoice document and classify the charges listed into two categories:

  1.  **Cargomen Own Charges**: These are charges directly related to Cargomen's own services. Examples include:
      *   Service Charges
      *   Loading & Unloading Charges
      *   Transportation Charges
      *   Handling Charges
      *   Agency Fees

  2.  **Reimbursement Charges**: These are charges that Cargomen pays to third parties on behalf of the customer and then gets reimbursed for. Examples include:
      *   Custodian Charges (e.g., DELHICARGOSERVICE-CUSTODIAN CHARGES)
      *   DO (Delivery Order) Charges
      *   Airline Terminal Handling Charges (e.g., Celebi charges)
      *   Storage Charges
      *   Statutory charges (like customs duties, taxes paid on behalf)
      *   Other third-party vendor charges passed through

  Analyze the following invoice document carefully. Identify each line item charge and determine if it falls under 'Cargomen Own Charges' or 'Reimbursement Charges'. Sum up the values for each category.

  Invoice Document:
  {{media url=invoicePdfDataUri}}

  Provide the total sum for Cargomen Own Charges and the total sum for Reimbursement Charges as a JSON object. Ensure accuracy in classification and calculation. Pay close attention to the descriptions of the charges.
  `,
});

const classifyInvoiceChargesFlow = ai.defineFlow<
  typeof ClassifyInvoiceChargesInputSchema,
  typeof ClassifyInvoiceChargesOutputSchema
>(
  {
    name: 'classifyInvoiceChargesFlow',
    inputSchema: ClassifyInvoiceChargesInputSchema,
    outputSchema: ClassifyInvoiceChargesOutputSchema,
  },
  async input => {
    // Pass the input directly to the prompt (which includes the data URI)
    const {output} = await classifyInvoiceChargesPrompt(input);
    if (!output) {
        throw new Error("AI failed to classify charges.");
    }
    return output;
  }
);
