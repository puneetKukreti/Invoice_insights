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
  cargomenOwnCharges: z.number().describe('The sum of strictly "SERVICE CHARGES", "LOADING & UNLOADING CHARGES", and "TRANSPORTATION".'),
  reimbursementCharges: z.number().describe('The sum of all other charges (excluding taxes) not classified as Cargomen Own Charges.'),
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
  // Refined prompt for stricter classification based on user feedback
  prompt: `You are an expert invoice processing specialist for Cargomen. Your task is to meticulously analyze the provided invoice document and classify each charge listed into ONLY one of two categories based on these VERY SPECIFIC rules:

  1.  **Cargomen Own Charges**: These are fees ONLY for the following specific services performed by Cargomen. Sum the amounts ONLY for line items with descriptions EXACTLY matching (or very close variations like pluralization) these phrases:
      *   SERVICE CHARGES (or AGENCY SERVICE CHARGES)
      *   LOADING & UNLOADING CHARGES
      *   TRANSPORTATION (or CARTAGE CHARGES)

  2.  **Reimbursement Charges**: These are ALL OTHER costs listed on the invoice that are NOT "SERVICE CHARGES", "LOADING & UNLOADING CHARGES", or "TRANSPORTATION". This includes, but is not limited to:
      *   Custodian Charges (e.g., DELHICARGOSERVICE-CUSTODIAN CHARGES, AAI charges)
      *   DO (Delivery Order) Charges / Airline DO Charges
      *   Airline Terminal Handling Charges / Ground Handling Charges (e.g., Celebi, IGIA)
      *   Airport Operator Charges
      *   Storage Charges / Demurrage Charges
      *   Statutory charges (e.g., Customs Duty, IGST - when listed as a line item cost paid on behalf, not the tax calculated on the total)
      *   Handling Charges / Agency Handling Charges (NOTE: These are NOT Own Charges unless explicitly listed as Loading/Unloading)
      *   Documentation Fees
      *   Processing Fees
      *   EDI Charges
      *   Any other third-party vendor charges clearly indicated as passed through (e.g., specific vendor names).

  Analyze the following invoice document **extremely carefully**. Examine each line item's description and amount.

  *   If a line item's description matches one of the three specific descriptions for **Cargomen Own Charges**, add its base amount to the \`cargomenOwnCharges\` sum.
  *   If a line item's description does NOT match one of those three, add its base amount to the \`reimbursementCharges\` sum.

  **Crucially, sum up the monetary values ONLY for the items you classify in each category.**

  Invoice Document:
  {{media url=invoicePdfDataUri}}

  Provide the *total sum* for Cargomen Own Charges and the *total sum* for Reimbursement Charges as a JSON object matching the output schema. Double-check your classifications against the strict rules above and your calculations for accuracy. **Do NOT include taxes like GST/CGST/SGST applied *on top* of these charges in either sum; focus only on the base charge amounts listed in the line items before tax calculation.**
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
        // Attempt to parse if they are strings that look like numbers
        const ownCharges = typeof output.cargomenOwnCharges === 'string' ? parseFloat(output.cargomenOwnCharges) : output.cargomenOwnCharges;
        const reimbCharges = typeof output.reimbursementCharges === 'string' ? parseFloat(output.reimbursementCharges) : output.reimbursementCharges;

        if (isNaN(ownCharges) || isNaN(reimbCharges)) {
           throw new Error("AI returned invalid data format for charges and could not parse numbers.");
        }
        console.warn("AI returned charges as strings, parsed successfully.");
        return { cargomenOwnCharges: ownCharges, reimbursementCharges: reimbCharges };

        // If strict number type is required, uncomment the line below and remove the parsing logic above
        // throw new Error("AI returned invalid data format for charges.");
    }
    return output;
  }
);
