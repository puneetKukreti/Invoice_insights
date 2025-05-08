// src/ai/flows/classify-invoice-charges.ts
'use server';

/**
 * @fileOverview Classifies invoice charges from the *first page* of an invoice PDF.
 * It extracts individual totals for Service, Loading/Unloading, and Transportation charges
 * from the 'Total (INR)' column, and sums for overall Cargomen Own Charges and Reimbursement Charges.
 *
 * - classifyInvoiceCharges - Classifies charges and extracts specific item totals.
 * - ClassifyInvoiceChargesInput - Input type.
 * - ClassifyInvoiceChargesOutput - Output type.
 */

import {ai} from '@/ai/ai-instance';
import {z} from 'genkit';

const ClassifyInvoiceChargesInputSchema = z.object({
  invoicePdfDataUri: z
    .string()
    .describe(
      "The invoice PDF file as a data URI. Expected format: 'data:application/pdf;base64,<encoded_data>'."
    ),
});
export type ClassifyInvoiceChargesInput = z.infer<typeof ClassifyInvoiceChargesInputSchema>;

const ClassifyInvoiceChargesOutputSchema = z.object({
  serviceChargesActual: z.number().describe("Actual 'Total (INR)' for Service Charges from invoice first page. Default to 0 if not found.").optional().default(0),
  loadingChargesActual: z.number().describe("Actual 'Total (INR)' for Loading & Unloading Charges from invoice first page. Default to 0 if not found.").optional().default(0),
  transportationChargesActual: z.number().describe("Actual 'Total (INR)' for Transportation charges from invoice first page. Default to 0 if not found.").optional().default(0),
  
  cargomenOwnCharges: z.number().describe('The sum of the "Total (INR)" values (including tax) for "SERVICE CHARGES", "LOADING & UNLOADING CHARGES", and "TRANSPORTATION" from the *first page* only. This should be the sum of the three `*Actual` fields above.').optional().default(0),
  reimbursementCharges: z.number().describe('The sum of the "Total (INR)" values (including tax) for all other charges not classified as Cargomen Own Charges, from the *first page* only.').optional().default(0),
});
export type ClassifyInvoiceChargesOutput = z.infer<typeof ClassifyInvoiceChargesOutputSchema>;

export async function classifyInvoiceCharges(
  input: ClassifyInvoiceChargesInput
): Promise<ClassifyInvoiceChargesOutput> {
  return classifyInvoiceChargesFlow(input);
}

const classifyInvoiceChargesPrompt = ai.definePrompt({
  name: 'classifyInvoiceChargesPrompt',
  input: {schema: ClassifyInvoiceChargesInputSchema},
  output: {schema: ClassifyInvoiceChargesOutputSchema},
  prompt: `You are an expert invoice processing specialist for Cargomen. Analyze **ONLY THE FIRST PAGE** of the provided invoice document.
  
  Your tasks:
  1.  Identify individual line items for "SERVICE CHARGES" (or "AGENCY SERVICE CHARGES"), "LOADING & UNLOADING CHARGES", and "TRANSPORTATION" (or "CARTAGE CHARGES"). For each of these, extract its value directly from the **"Total (INR)"** column on the first page. If a specific charge type is not found, its value is 0.
      *   Store these as \`serviceChargesActual\`, \`loadingChargesActual\`, and \`transportationChargesActual\` respectively.
  2.  Calculate \`cargomenOwnCharges\` by summing the "Total (INR)" values for ONLY these three specific service types found on the first page. This should equal the sum of \`serviceChargesActual\`, \`loadingChargesActual\`, and \`transportationChargesActual\`.
  3.  Calculate \`reimbursementCharges\` by summing the "Total (INR)" values for ALL OTHER line items listed in the charge breakdown section on the first page that are NOT one of the three specific "Cargomen Own Charges" types.

  **Definitions & Rules (First Page Only, "Total (INR)" column for all values):**
  *   **Specific Cargomen Own Charge Items for Actuals:**
      *   "SERVICE CHARGES" (or "AGENCY SERVICE CHARGES"): Extract its "Total (INR)" into \`serviceChargesActual\`.
      *   "LOADING & UNLOADING CHARGES": Extract its "Total (INR)" into \`loadingChargesActual\`.
      *   "TRANSPORTATION" (or "CARTAGE CHARGES"): Extract its "Total (INR)" into \`transportationChargesActual\`.
  *   **Sum for \`cargomenOwnCharges\`**: Sum of the "Total (INR)" from the three types above.
  *   **Sum for \`reimbursementCharges\`**: Sum of "Total (INR)" for all other line items on the first page not listed above (e.g., Custodian Charges, DO Charges, Airline Terminal Handling, Airport Operator Charges, Storage, Statutory line items, other Handling/Agency/Documentation/Processing/EDI fees, CCL-T-CFS CHARGES, etc.).

  **CRITICAL INSTRUCTIONS:**
  *   **PROCESS ONLY THE FIRST PAGE.** Ignore all data on subsequent pages.
  *   **USE ONLY THE "Total (INR)" COLUMN** for all monetary values.
  *   If "SERVICE CHARGES" line item has a "Total (INR)" of 5310.00, then \`serviceChargesActual\` = 5310.00.
  *   If "LOADING & UNLOADING CHARGES" line item has a "Total (INR)" of 590.00, then \`loadingChargesActual\` = 590.00.
  *   If "TRANSPORTATION" line item has a "Total (INR)" of 6160.00, then \`transportationChargesActual\` = 6160.00.
  *   Then, \`cargomenOwnCharges\` would be 5310.00 + 590.00 + 6160.00 = 12060.00.
  *   If "CCL-T-CFS CHARGES" has a "Total (INR)" of 1516.00, this contributes to \`reimbursementCharges\`.
  *   Return 0 for any \`*Actual\` field if the specific charge item is not found.
  *   Return 0 for \`cargomenOwnCharges\` or \`reimbursementCharges\` if no matching charges are found.
  *   Ensure output values are valid JSON numbers.

  Invoice Document (Analyze First Page Only):
  {{media url=invoicePdfDataUri maxPages=1}}

  Provide the final results as a JSON object matching the output schema.
  Example based on the values above: {"serviceChargesActual": 5310.00, "loadingChargesActual": 590.00, "transportationChargesActual": 6160.00, "cargomenOwnCharges": 12060.00, "reimbursementCharges": 1516.00}
  If SERVICE CHARGES was not present, it would be: {"serviceChargesActual": 0, "loadingChargesActual": 590.00, "transportationChargesActual": 6160.00, "cargomenOwnCharges": 6750.00, "reimbursementCharges": 1516.00}
  `,
});

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

const classifyInvoiceChargesFlow = ai.defineFlow(
  {
    name: 'classifyInvoiceChargesFlow',
    inputSchema: ClassifyInvoiceChargesInputSchema,
    outputSchema: ClassifyInvoiceChargesOutputSchema,
  },
  async (input) => {
    console.log("Calling classifyInvoiceChargesPrompt (first page) expecting individual actuals and sums...");
    const { output } = await classifyInvoiceChargesPrompt(input);
    console.log("Raw output from classifyInvoiceChargesPrompt (first page):", output);

    if (!output) {
        console.error("AI failed to classify charges. No output. Returning zero charges.");
        return { 
          serviceChargesActual: 0, 
          loadingChargesActual: 0, 
          transportationChargesActual: 0,
          cargomenOwnCharges: 0, 
          reimbursementCharges: 0 
        };
    }

    const serviceActual = parseChargeValue(output.serviceChargesActual);
    const loadingActual = parseChargeValue(output.loadingChargesActual);
    const transportActual = parseChargeValue(output.transportationChargesActual);
    let ownCharges = parseChargeValue(output.cargomenOwnCharges);
    const reimbCharges = parseChargeValue(output.reimbursementCharges);

    // Recalculate ownCharges based on actuals as a safeguard, if the AI didn't sum it correctly
    const calculatedOwnCharges = serviceActual + loadingActual + transportActual;
    if (ownCharges !== calculatedOwnCharges && calculatedOwnCharges > 0) {
        console.warn(`AI ownCharges (${ownCharges}) differs from sum of actuals (${calculatedOwnCharges}). Using sum of actuals.`);
        ownCharges = calculatedOwnCharges;
    } else if (ownCharges === 0 && calculatedOwnCharges > 0) {
        // If AI returned 0 for ownCharges but actuals have values
        ownCharges = calculatedOwnCharges;
    }


    console.log(`Parsed charges from first page - ServiceActual: ${serviceActual}, LoadingActual: ${loadingActual}, TransportActual: ${transportActual}, OwnSum: ${ownCharges}, ReimbursementSum: ${reimbCharges}`);

    return {
        serviceChargesActual: serviceActual,
        loadingChargesActual: loadingActual,
        transportationChargesActual: transportActual,
        cargomenOwnCharges: ownCharges,
        reimbursementCharges: reimbCharges
    };
  }
);
