// src/ai/flows/classify-invoice-charges.ts
'use server';

/**
 * @fileOverview Classifies invoice charges into 'Cargomen Own Charges' and 'Reimbursement Charges' directly from an invoice PDF, summing the total amounts including tax.
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

// Adjusted output schema descriptions to reflect inclusion of tax
const ClassifyInvoiceChargesOutputSchema = z.object({
  cargomenOwnCharges: z.number().describe('The sum of the "Total (INR)" values (including tax) for strictly "SERVICE CHARGES", "LOADING & UNLOADING CHARGES", and "TRANSPORTATION".').optional().default(0),
  reimbursementCharges: z.number().describe('The sum of the "Total (INR)" values (including tax) for all other charges not classified as Cargomen Own Charges.').optional().default(0),
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
  // Updated prompt to sum the "Total (INR)" column including tax
  prompt: `You are an expert invoice processing specialist for Cargomen. Your task is to meticulously analyze the charge breakdown section (usually a table with columns like 'Description', 'Taxable Value', 'IGST', 'Total (INR)') of the provided invoice document. You need to classify each individual charge line item into ONLY one of two categories based on its description, and then sum the **Total (INR)** values (which include tax for that line item) for each category according to these VERY SPECIFIC rules:

  **Definitions:**
  1.  **Cargomen Own Charges**: These are fees ONLY for the following specific services performed directly by Cargomen. Sum the amounts ONLY from the **"Total (INR)"** column for line items with descriptions EXACTLY matching (case-insensitive, allow for pluralization like 'CHARGE' vs 'CHARGES') these phrases:
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
      *   If the description EXACTLY matches one of the three specific phrases for **Cargomen Own Charges** (case-insensitive, allowing pluralization), add its corresponding **Total (INR)** amount (the final value listed for that line item *after* tax, usually in the rightmost amount column) to the \`cargomenOwnCharges\` sum.
      *   If the line item description does NOT match one of those three specific phrases, add its corresponding **Total (INR)** amount to the \`reimbursementCharges\` sum.

  **CRITICAL:**
  *   **Sum ONLY the "Total (INR)" values from the individual charge line items.**
  *   **DO NOT include the overall invoice total or any overall tax amounts** (like final CGST, SGST, IGST) that are calculated on the *subtotal* or *grand total* of the invoice. Only sum the values found in the **"Total (INR)"** column (or equivalent final amount column) within the charge breakdown table itself.
  *   Be precise. Only the three explicitly mentioned descriptions count as 'Own Charges'. Everything else listed as a distinct charge line item is a 'Reimbursement Charge'.
  *   Double-check your classifications against the strict rules above and ensure your arithmetic sums using the **Total (INR)** values are accurate.
  *   Return 0 for a category if no matching charges are found.
  *   Ensure the output values are valid JSON numbers, not strings or formatted currency.

  Invoice Document:
  {{media url=invoicePdfDataUri}}

  Provide the final *total sum* for \`cargomenOwnCharges\` and the final *total sum* for \`reimbursementCharges\` (both including the line item taxes) as a JSON object matching the output schema. Example: {"cargomenOwnCharges": 1750.00, "reimbursementCharges": 3000.50}
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
    console.log("Calling classifyInvoiceChargesPrompt with PDF data URI (expecting total incl. tax)...");
    const { output } = await classifyInvoiceChargesPrompt(input);
    console.log("Received raw output from classifyInvoiceChargesPrompt:", output);

    if (!output) {
        console.error("AI failed to classify charges. No output received. Returning zero charges.");
        return { cargomenOwnCharges: 0, reimbursementCharges: 0 }; // Return default zero values
    }

    // Safely parse the output values
    const ownCharges = parseChargeValue(output.cargomenOwnCharges);
    const reimbCharges = parseChargeValue(output.reimbursementCharges);

    console.log(`Parsed charges (incl. tax) - Own: ${ownCharges}, Reimbursement: ${reimbCharges}`);

    // Ensure the final return object matches the schema (even if parsing failed and returned 0)
    return {
        cargomenOwnCharges: ownCharges,
        reimbursementCharges: reimbCharges
    };
  }
);
