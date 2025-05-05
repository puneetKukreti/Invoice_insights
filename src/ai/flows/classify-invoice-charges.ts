// src/ai/flows/classify-invoice-charges.ts
'use server';

/**
 * @fileOverview Classifies invoice charges into 'Cargomen Own Charges' and 'Reimbursement Charges' directly from the *first page* of an invoice PDF, summing the total amounts including tax from the 'Total (INR)' column.
 *
 * - classifyInvoiceCharges - A function that classifies invoice charges from a PDF data URI (first page only).
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

// Adjusted output schema descriptions to reflect inclusion of tax from the Total (INR) column
const ClassifyInvoiceChargesOutputSchema = z.object({
  cargomenOwnCharges: z.number().describe('The sum of the "Total (INR)" values (including tax) for strictly "SERVICE CHARGES", "LOADING & UNLOADING CHARGES", and "TRANSPORTATION" taken directly from the "Total (INR)" column on the *first page* only.').optional().default(0),
  reimbursementCharges: z.number().describe('The sum of the "Total (INR)" values (including tax) for all other charges not classified as Cargomen Own Charges, taken directly from the "Total (INR)" column on the *first page* only.').optional().default(0),
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
  // Updated prompt to sum the "Total (INR)" column including tax, with extreme emphasis and corrected example from screenshot.
  // Added instruction to ONLY process the FIRST PAGE.
  prompt: `You are an expert invoice processing specialist for Cargomen. Your task is to meticulously analyze the charge breakdown section (usually a table with columns like 'Description', 'Taxable Value', 'IGST', 'Total (INR)') found **ONLY ON THE FIRST PAGE** of the provided invoice document. Ignore all subsequent pages. You need to classify each individual charge line item found on the first page into ONLY one of two categories based on its description, and then sum the values **ONLY** from the **"Total (INR)"** column for each category according to these VERY SPECIFIC rules:

  **Definitions:**
  1.  **Cargomen Own Charges**: These are fees ONLY for the following specific services performed directly by Cargomen. Sum the amounts ONLY from the **"Total (INR)"** column for line items found on the **first page** with descriptions EXACTLY matching (case-insensitive, allow for pluralization like 'CHARGE' vs 'CHARGES') these phrases:
      *   SERVICE CHARGES (or AGENCY SERVICE CHARGES)
      *   LOADING & UNLOADING CHARGES
      *   TRANSPORTATION (or CARTAGE CHARGES)

  2.  **Reimbursement Charges**: These are ALL OTHER costs listed as individual line items in the charge breakdown section on the **first page** that are NOT one of the three specific "Cargomen Own Charges" listed above. Sum the amounts ONLY from the **"Total (INR)"** column for these items. This includes, but is not limited to:
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
      *   CCL-T-CFS CHARGES
      *   Any other third-party vendor charges clearly indicated as passed through (e.g., specific vendor names mentioned in the description).

  **Instructions:**
  Analyze **ONLY THE FIRST PAGE** of the following invoice document **extremely carefully**. Go line by line through the charges listed (usually in a table format) on that first page.

  *   For each line item on the first page:
      *   Examine its description.
      *   If the description EXACTLY matches one of the three specific phrases for **Cargomen Own Charges** (case-insensitive, allowing pluralization), add its corresponding **Total (INR)** amount (the final value listed for that line item *after* tax, located in the "Total (INR)" column) to the \`cargomenOwnCharges\` sum.
      *   If the line item description does NOT match one of those three specific phrases, add its corresponding **Total (INR)** amount (from the "Total (INR)" column) to the \`reimbursementCharges\` sum.

  **CRITICAL:**
  *   **PROCESS ONLY THE FIRST PAGE.** Ignore all data and charges on subsequent pages.
  *   **YOU MUST USE THE VALUE FROM THE "Total (INR)" COLUMN ONLY.** Do NOT use the 'Taxable Value' or 'Tax' columns for summation.
  *   **Example (based on first page data only):** If the first page shows:
      *   SERVICE CHARGES | ... | 4500.00 | ... | 810.00 | **5310.00**
      *   LOADING & UNLOADING CHARGES | ... | 500.00 | ... | 90.00 | **590.00**
      *   CCL-T-CFS CHARGES | ... | 1284.74 | ... | 231.26 | **1516.00**
      *   TRANSPORTATION | ... | 5500.00 | ... | 660.00 | **6160.00**
      Then:
      *   \`cargomenOwnCharges\` = 5310.00 + 590.00 + 6160.00 = 12060.00
      *   \`reimbursementCharges\` = 1516.00
  *   **DO NOT include the overall invoice subtotal, total tax, or grand total.** Only sum the values found in the **"Total (INR)"** column within the charge breakdown table itself for individual line items **on the first page**.
  *   Be precise. Only the three explicitly mentioned descriptions count as 'Own Charges'. Everything else listed as a distinct charge line item on the first page is a 'Reimbursement Charge'.
  *   Double-check your classifications against the strict rules above and ensure your arithmetic sums using ONLY the **"Total (INR)"** values from the first page are accurate.
  *   Return 0 for a category if no matching charges are found on the first page.
  *   Ensure the output values are valid JSON numbers, not strings or formatted currency.

  Invoice Document (Analyze First Page Only):
  {{media url=invoicePdfDataUri maxPages=1}}

  Provide the final *total sum* for \`cargomenOwnCharges\` and the final *total sum* for \`reimbursementCharges\` (both derived strictly from the "Total (INR)" column on the first page) as a JSON object matching the output schema. Example based on the values above: {"cargomenOwnCharges": 12060.00, "reimbursementCharges": 1516.00}
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
    console.log("Calling classifyInvoiceChargesPrompt with PDF data URI (expecting total incl. tax from 'Total (INR)' column on first page)...");
    const { output } = await classifyInvoiceChargesPrompt(input);
    console.log("Received raw output from classifyInvoiceChargesPrompt (first page):", output);

    if (!output) {
        console.error("AI failed to classify charges from first page. No output received. Returning zero charges.");
        return { cargomenOwnCharges: 0, reimbursementCharges: 0 }; // Return default zero values
    }

    // Safely parse the output values
    const ownCharges = parseChargeValue(output.cargomenOwnCharges);
    const reimbCharges = parseChargeValue(output.reimbursementCharges);

    console.log(`Parsed charges from first page (from Total (INR)) - Own: ${ownCharges}, Reimbursement: ${reimbCharges}`);

    // Ensure the final return object matches the schema (even if parsing failed and returned 0)
    return {
        cargomenOwnCharges: ownCharges,
        reimbursementCharges: reimbCharges
    };
  }
);
