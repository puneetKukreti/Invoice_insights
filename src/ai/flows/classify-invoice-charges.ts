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
  cargomenOwnCharges: z.number().describe('The sum of Cargomen own charges (e.g., Service, Handling, Transportation).'),
  reimbursementCharges: z.number().describe('The sum of reimbursement charges (e.g., Custodian, DO, Terminal Handling, Storage, Statutory).'),
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
  // Refined prompt for better classification accuracy
  prompt: `You are an expert invoice processing specialist for Cargomen. Your task is to meticulously analyze the provided invoice document and classify each charge listed into ONLY one of two categories:

  1.  **Cargomen Own Charges**: These are fees for services directly performed or provided by Cargomen itself. Examples include:
      *   Service Charges / Agency Service Charges
      *   Loading & Unloading Charges
      *   Transportation Charges / Cartage Charges
      *   Handling Charges / Agency Handling Charges
      *   Documentation Fees (if charged by Cargomen)
      *   Processing Fees
      *   EDI Charges (if by Cargomen)
      *   Any other fee explicitly described as a Cargomen service fee.

  2.  **Reimbursement Charges**: These are costs incurred by Cargomen when paying third parties (vendors, government agencies, facility operators) on behalf of the customer. Cargomen passes these costs through to the customer for reimbursement. Examples include:
      *   Custodian Charges (e.g., DELHICARGOSERVICE-CUSTODIAN CHARGES, AAI charges)
      *   DO (Delivery Order) Charges / Airline DO Charges
      *   Airline Terminal Handling Charges / Ground Handling Charges (e.g., Celebi, IGIA)
      *   Airport Operator Charges
      *   Storage Charges / Demurrage Charges
      *   Statutory charges (e.g., Customs Duty, IGST, other taxes paid on behalf)
      *   Other third-party vendor charges clearly indicated as passed through (e.g., specific vendor names).

  Analyze the following invoice document **extremely carefully**. Examine each line item's description and amount. Determine if it falls under 'Cargomen Own Charges' or 'Reimbursement Charges' based **strictly** on the definitions above.

  **Crucially, sum up the monetary values ONLY for the items you classify in each category.**

  Invoice Document:
  {{media url=invoicePdfDataUri}}

  Provide the *total sum* for Cargomen Own Charges and the *total sum* for Reimbursement Charges as a JSON object matching the output schema. Double-check your classifications and calculations for accuracy. If a charge description is ambiguous, lean towards classifying it as a Reimbursement Charge unless it clearly matches a Cargomen Own Service. Do not include taxes like GST/CGST/SGST applied *on top* of these charges in either sum, focus only on the base charge amounts listed in the line items before tax calculation.
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
    console.log("Calling classifyInvoiceChargesPrompt with PDF data URI...");
    const {output} = await classifyInvoiceChargesPrompt(input);
    console.log("Received output from classifyInvoiceChargesPrompt:", output);
    if (!output) {
        throw new Error("AI failed to classify charges. No output received.");
    }
     if (typeof output.cargomenOwnCharges !== 'number' || typeof output.reimbursementCharges !== 'number') {
        console.error("Invalid output format from AI:", output);
        throw new Error("AI returned invalid data format for charges.");
    }
    return output;
  }
);
