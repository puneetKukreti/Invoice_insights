
// src/ai/flows/classify-invoice-charges.ts
'use server';

/**
 * @fileOverview Classifies invoice charges from the *first page* of an invoice PDF.
 * It extracts 'Service Charges', 'Loading & Unloading Charges', 'Transportation Charges',
 * and 'Reimbursement Charges' by summing their respective 'Total (INR)' column values including tax.
 *
 * - classifyInvoiceCharges - A function that classifies invoice charges from a PDF data URI (first page only).
 * - ClassifyInvoiceChargesInput - The input type for the classifyInvoiceCharges function.
 * - ClassifyInvoiceChargesOutput - The return type for the classifyInvoiceCharges function.
 */

import {ai} from '@/ai/ai-instance';
import {z} from 'genkit';

const ClassifyInvoiceChargesInputSchema = z.object({
  invoicePdfDataUri: z
    .string()
    .describe(
      "The invoice PDF file as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:application/pdf;base64,<encoded_data>'."
    ),
});
export type ClassifyInvoiceChargesInput = z.infer<typeof ClassifyInvoiceChargesInputSchema>;

const ClassifyInvoiceChargesOutputSchema = z.object({
  serviceCharges: z.number().describe('The sum of "Total (INR)" values (including tax) for "SERVICE CHARGES" or "AGENCY SERVICE CHARGES" from the first page only.').optional().default(0),
  loadingUnloadingCharges: z.number().describe('The sum of "Total (INR)" values (including tax) for "LOADING & UNLOADING CHARGES" from the first page only.').optional().default(0),
  transportationCharges: z.number().describe('The sum of "Total (INR)" values (including tax) for "TRANSPORTATION" or "CARTAGE CHARGES" from the first page only.').optional().default(0),
  reimbursementCharges: z.number().describe('The sum of the "Total (INR)" values (including tax) for all other charges not classified as Service, Loading/Unloading, or Transportation charges, taken directly from the "Total (INR)" column on the *first page* only.').optional().default(0),
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
    schema: ClassifyInvoiceChargesInputSchema,
  },
  output: {
    schema: ClassifyInvoiceChargesOutputSchema,
  },
  prompt: `You are an expert invoice processing specialist for Cargomen. Your task is to meticulously analyze the charge breakdown section (usually a table with columns like 'Description', 'Taxable Value', 'IGST', 'Total (INR)') found **ONLY ON THE FIRST PAGE** of the provided invoice document. Ignore all subsequent pages. You need to classify each individual charge line item found on the first page into specific categories, and then sum the values **ONLY** from the **"Total (INR)"** column for each category according to these VERY SPECIFIC rules:

  **Charge Categories & Definitions (Values taken from "Total (INR)" column on FIRST PAGE ONLY):**
  1.  **Service Charges**: Sum the amounts from the "Total (INR)" column for line items with descriptions EXACTLY matching (case-insensitive, allow for pluralization like "CHARGE" vs "CHARGES") "SERVICE CHARGES" or "AGENCY SERVICE CHARGES". Output this sum as \`serviceCharges\`.
  2.  **Loading & Unloading Charges**: Sum the amounts from the "Total (INR)" column for line items with descriptions EXACTLY matching (case-insensitive, allow for pluralization) "LOADING & UNLOADING CHARGES". Output this sum as \`loadingUnloadingCharges\`.
  3.  **Transportation Charges**: Sum the amounts from the "Total (INR)" column for line items with descriptions EXACTLY matching (case-insensitive, allow for pluralization) "TRANSPORTATION" or "CARTAGE CHARGES". Output this sum as \`transportationCharges\`.
  4.  **Reimbursement Charges**: These are ALL OTHER costs listed as individual line items in the charge breakdown section on the **first page** that are NOT one of the three specific charges listed above (Service, Loading/Unloading, Transportation). Sum the amounts from the "Total (INR)" column for these items. Output this sum as \`reimbursementCharges\`. This includes, but is not limited to:
      *   Custodian Charges (e.g., DELHICARGOSERVICE-CUSTODIAN CHARGES, AAI charges)
      *   DO (Delivery Order) Charges / Airline DO Charges
      *   Airline Terminal Handling Charges / Ground Handling Charges (e.g., Celebi, IGIA)
      *   Airport Operator Charges
      *   Storage Charges / Demurrage Charges
      *   Statutory charges (e.g., Customs Duty, IGST - ONLY when listed as a specific line item cost paid on behalf, NOT the final tax calculation on the total)
      *   Handling Charges / Agency Handling Charges (NOTE: These are NOT Service, Loading/Unloading or Transportation Charges unless explicitly described as such)
      *   Documentation Fees
      *   Processing Fees
      *   EDI Charges
      *   CCL-T-CFS CHARGES
      *   Any other third-party vendor charges clearly indicated as passed through (e.g., specific vendor names mentioned in the description).

  **Instructions:**
  You must process **ONLY THE FIRST PAGE** of the provided invoice.
  Your goal is to categorize every charge line item found in the charge breakdown table on the first page and sum their **"Total (INR)"** values into the correct output fields.

  Follow this classification logic for each line item on the first page:
  1.  **Service Charges Check**: If the line item description EXACTLY matches (case-insensitive, allowing for pluralization like "CHARGE" vs "CHARGES") "SERVICE CHARGES" or "AGENCY SERVICE CHARGES", add its "Total (INR)" amount to the \`serviceCharges\` sum.
  2.  **Loading & Unloading Charges Check**: Else, if the line item description EXACTLY matches (case-insensitive, allowing for pluralization) "LOADING & UNLOADING CHARGES", add its "Total (INR)" amount to the \`loadingUnloadingCharges\` sum.
  3.  **Transportation Charges Check**: Else, if the line item description EXACTLY matches (case-insensitive, allowing for pluralization) "TRANSPORTATION" or "CARTAGE CHARGES", add its "Total (INR)" amount to the \`transportationCharges\` sum.
  4.  **Reimbursement Charges (Default)**: Else (i.e., if the description does not match any of the specific phrases above), it is a Reimbursement Charge. Add its "Total (INR)" amount to the \`reimbursementCharges\` sum. This category is for all other charges on the first page, such as "DELHICARGOSERVICE-CUSTODIAN CHARGES", "AAI charges", "DO Charges", etc., as listed in the "Reimbursement Charges" definition earlier.

  Ensure every line item in the charge breakdown table on the first page is considered and its "Total (INR)" value is allocated to one, and only one, of the four output charge categories.

  **CRITICAL:**
  *   **PROCESS ONLY THE FIRST PAGE.** Ignore all data and charges on subsequent pages.
  *   **YOU MUST USE THE VALUE FROM THE "Total (INR)" COLUMN ONLY.** Do NOT use the 'Taxable Value' or 'Tax' columns for summation.
  *   **Example (based on first page data only):** If the first page shows:
      *   SERVICE CHARGES | ... | 4500.00 | ... | 810.00 | **5310.00**
      *   LOADING & UNLOADING CHARGES | ... | 500.00 | ... | 90.00 | **590.00**
      *   DELHICARGOSERVICE-CUSTODIAN CHARGES | ... | 1000.00 | ... | 180.00 | **1180.00**
      *   TRANSPORTATION | ... | 5500.00 | ... | 660.00 | **6160.00**
      Then:
      *   \`serviceCharges\` = 5310.00
      *   \`loadingUnloadingCharges\` = 590.00
      *   \`transportationCharges\` = 6160.00
      *   \`reimbursementCharges\` = 1180.00 (because "DELHICARGOSERVICE-CUSTODIAN CHARGES" does not exactly match the other three categories)
  *   **DO NOT include the overall invoice subtotal, total tax, or grand total.** Only sum the values found in the **"Total (INR)"** column within the charge breakdown table itself for individual line items **on the first page**.
  *   Be precise. Only the three explicitly mentioned descriptions (Service, Loading/Unloading, Transportation) are broken out. Everything else listed as a distinct charge line item on the first page is a 'Reimbursement Charge'.
  *   Double-check your classifications against the strict rules above and ensure your arithmetic sums using ONLY the **"Total (INR)"** values from the first page are accurate.
  *   Return 0 for a category if no matching charges are found on the first page.
  *   Ensure the output values are valid JSON numbers, not strings or formatted currency.

  Invoice Document (Analyze First Page Only):
  {{media url=invoicePdfDataUri maxPages=1}}

  Provide the final *total sum* for \`serviceCharges\`, \`loadingUnloadingCharges\`, \`transportationCharges\`, and \`reimbursementCharges\` (all derived strictly from the "Total (INR)" column on the first page) as a JSON object matching the output schema.
  `,
});


// Utility function to safely parse potential number strings
function parseChargeValue(value: any): number {
  if (typeof value === 'number') {
    return isNaN(value) ? 0 : value;
  }
  if (typeof value === 'string') {
    const cleanedValue = value.replace(/[^0-9.-]+/g, "");
    const number = parseFloat(cleanedValue);
    return isNaN(number) ? 0 : number;
  }
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
    console.log("Calling classifyInvoiceChargesPrompt with PDF data URI (expecting individual charges from 'Total (INR)' column on first page)...");
    const { output } = await classifyInvoiceChargesPrompt(input);
    console.log("Received raw output from classifyInvoiceChargesPrompt (first page):", output);

    if (!output) {
        console.error("AI failed to classify charges from first page. No output received. Returning zero charges.");
        return { serviceCharges: 0, loadingUnloadingCharges: 0, transportationCharges: 0, reimbursementCharges: 0 };
    }

    const serviceChg = parseChargeValue(output.serviceCharges);
    const loadingUnloadingChg = parseChargeValue(output.loadingUnloadingCharges);
    const transportationChg = parseChargeValue(output.transportationCharges);
    const reimbChg = parseChargeValue(output.reimbursementCharges);

    console.log(`Parsed charges from first page (from Total (INR)) - Service: ${serviceChg}, L&U: ${loadingUnloadingChg}, Transport: ${transportationChg}, Reimbursement: ${reimbChg}`);

    return {
        serviceCharges: serviceChg,
        loadingUnloadingCharges: loadingUnloadingChg,
        transportationCharges: transportationChg,
        reimbursementCharges: reimbChg
    };
  }
);

    