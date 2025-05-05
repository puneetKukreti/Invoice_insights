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

// Adjusted output schema to handle potentially missing or non-numeric values gracefully
const ClassifyInvoiceChargesOutputSchema = z.object({
  cargomenOwnCharges: z.number().describe('The sum of strictly "SERVICE CHARGES", "LOADING & UNLOADING CHARGES", and "TRANSPORTATION".').optional().default(0),
  reimbursementCharges: z.number().describe('The sum of all other charges (excluding taxes) not classified as Cargomen Own Charges.').optional().default(0),
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
    // Output schema expects numbers, handling parsing in the flow
    schema: ClassifyInvoiceChargesOutputSchema,
  },
  // Further refined prompt for stricter classification and calculation
  prompt: `You are an expert invoice processing specialist for Cargomen. Your task is to meticulously analyze the charge breakdown section of the provided invoice document and classify each individual charge line item into ONLY one of two categories based on these VERY SPECIFIC rules:

  **Definitions:**
  1.  **Cargomen Own Charges**: These are fees ONLY for the following specific services performed directly by Cargomen. Sum the amounts ONLY for line items with descriptions EXACTLY matching (case-insensitive, allow for pluralization like 'CHARGE' vs 'CHARGES') these phrases:
      *   SERVICE CHARGES (or AGENCY SERVICE CHARGES)
      *   LOADING & UNLOADING CHARGES
      *   TRANSPORTATION (or CARTAGE CHARGES)

  2.  **Reimbursement Charges**: These are ALL OTHER costs listed as individual line items in the charge breakdown section that are NOT one of the three specific "Cargomen Own Charges" listed above. This includes, but is not limited to:
      *   Custodian Charges (e.g., DELHICARGOSERVICE-CUSTODIAN CHARGES, AAI charges)
      *   DO (Delivery Order) Charges / Airline DO Charges
      *   Airline Terminal Handling Charges / Ground Handling Charges (e.g., Celebi, IGIA)
      *   Airport Operator Charges
      *   Storage Charges / Demurrage Charges
      *   Statutory charges (e.g., Customs Duty, IGST - ONLY when listed as a specific line item cost paid on behalf, NOT the final tax calculation on the total)
      *   Handling Charges / Agency Handling Charges (NOTE: These are NOT Own Charges unless explicitly described as Loading/Unloading or Transportation/Cartage)
      *   Documentation Fees
      *   Processing Fees
      *   EDI Charges
      *   Any other third-party vendor charges clearly indicated as passed through (e.g., specific vendor names mentioned in the description).

  **Instructions:**
  Analyze the following invoice document **extremely carefully**. Go line by line through the charges listed (usually in a table format).

  *   For each line item:
      *   Examine its description.
      *   If the description EXACTLY matches one of the three specific phrases for **Cargomen Own Charges** (case-insensitive, allowing pluralization), add its corresponding base amount (the value listed for that line item *before* any taxes like GST/CGST/SGST are applied) to the \`cargomenOwnCharges\` sum.
      *   If the line item description does NOT match one of those three specific phrases, add its corresponding base amount to the \`reimbursementCharges\` sum.

  **CRITICAL:**
  *   **DO NOT include overall taxes** (like GST, CGST, SGST) that are calculated on the *subtotal* or *total* of the invoice in EITHER category. Only sum the amounts listed for the individual charge line items themselves.
  *   Be precise. Only the three explicitly mentioned descriptions count as 'Own Charges'. Everything else listed as a distinct charge line item is a 'Reimbursement Charge'.
  *   Double-check your classifications against the strict rules above and ensure your arithmetic sums are accurate.
  *   Return 0 for a category if no matching charges are found.
  *   Ensure the output values are valid JSON numbers, not strings or formatted currency.

  Invoice Document:
  {{media url=invoicePdfDataUri}}

  Provide the final *total sum* for \`cargomenOwnCharges\` and the final *total sum* for \`reimbursementCharges\` as a JSON object matching the output schema. Example: {"cargomenOwnCharges": 1500.00, "reimbursementCharges": 2550.50}
  `,
});


// Utility function to safely parse potential number strings
function parseChargeValue(value: any): number {
  if (typeof value === 'number') {
    return isNaN(value) ? 0 : value;
  }
  if (typeof value === 'string') {
    // Remove currency symbols, commas, and extraneous characters, keep decimal point and negative sign
    const cleanedValue = value.replace(/[^0-9.-]+/g, "");
    const number = parseFloat(cleanedValue);
    return isNaN(number) ? 0 : number;
  }
  // If it's not a number or a string, return 0
  return 0;
}

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
    console.log("Calling classifyInvoiceChargesPrompt with PDF data URI...");
    const { output } = await classifyInvoiceChargesPrompt(input);
    console.log("Received raw output from classifyInvoiceChargesPrompt:", output);

    if (!output) {
        console.error("AI failed to classify charges. No output received. Returning zero charges.");
        return { cargomenOwnCharges: 0, reimbursementCharges: 0 }; // Return default zero values
    }

    // Safely parse the output values
    const ownCharges = parseChargeValue(output.cargomenOwnCharges);
    const reimbCharges = parseChargeValue(output.reimbursementCharges);

    console.log(`Parsed charges - Own: ${ownCharges}, Reimbursement: ${reimbCharges}`);

    // Ensure the final return object matches the schema (even if parsing failed and returned 0)
    return {
        cargomenOwnCharges: ownCharges,
        reimbursementCharges: reimbCharges
    };
  }
);
