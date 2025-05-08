'use server';
/**
 * @fileOverview Extracts rates from a Cargomen quotation PDF.
 *
 * - extractQuotationRates - Extracts rates for service, loading, and transportation.
 * - ExtractQuotationRatesInput - Input type (PDF data URI).
 * - ExtractQuotationRatesOutput - Output type containing extracted rates.
 */

import { ai } from '@/ai/ai-instance';
import { z } from 'genkit';
import type { QuotationRates } from '@/types/invoice'; // For type hint

const ExtractQuotationRatesInputSchema = z.object({
  quotationPdfDataUri: z
    .string()
    .describe(
      "The quotation PDF file as a data URI. Expected format: 'data:application/pdf;base64,<encoded_data>'."
    ),
});
export type ExtractQuotationRatesInput = z.infer<typeof ExtractQuotationRatesInputSchema>;

// This schema definition matches QuotationRates in types/invoice.ts
const QuotationRatesSchema = z.object({
  airServiceChargeRate: z.number().optional().describe("Fixed numeric rate for Air Service Charges if available from quotation (e.g., 4000 if 'Min. Rs.4000'). If percentage or 'At actual', this should be undefined."),
  airServiceChargeDescription: z.string().optional().describe("Full text description of Air Service Charges from quotation (e.g., '0.12% Of Assessable value or Subject to Min. Rs.4000/- per BOE')."),
  airLoadingChargeRate: z.number().optional().describe("Fixed numeric rate for Air Loading Charges (e.g., 200 if 'Min of Rs. 200'). If 'At actual', undefined."),
  airLoadingChargeDescription: z.string().optional().describe("Full text description of Air Loading Charges (e.g., 'Rs. 0.50 per Kg Sub. to a Min of Rs. 200' or 'At actual as per receipt')."),
  airTransportationChargeRate: z.number().optional().describe("Fixed numeric rate for a common Air Transportation Charge if one clear value is present (e.g., for a specific load limit). If multiple rates or complex, undefined."),
  airTransportationChargeDescription: z.string().optional().describe("Full text description of Air Transportation Charges, can include multiple options."),

  oceanServiceChargeRate: z.number().optional().describe("Fixed numeric rate for Ocean Service Charges (e.g., 4500 if 'Min. Rs.4500'). If percentage or 'At actual', undefined."),
  oceanServiceChargeDescription: z.string().optional().describe("Full text description of Ocean Service Charges (e.g., '0.12% of Assessable value or Sub. to Min.Rs.4500 per BOE For LCL Shipment & Rs.6500 per Container')."),
  oceanLoadingChargeRate: z.number().optional().describe("Fixed numeric rate for Ocean Loading/Unloading Charges (e.g., 500 if 'Min Rs.500'). If 'At actual', undefined."),
  oceanLoadingChargeDescription: z.string().optional().describe("Full text description of Ocean Loading/Unloading Charges (e.g., 'Rs.0.50 per kg Subject to Min Rs.500 per shipment')."),
  oceanTransportationChargeRate: z.number().optional().describe("Fixed numeric rate for a common Ocean Transportation Charge if one clear value is present. If multiple rates or complex, undefined."),
  oceanTransportationChargeDescription: z.string().optional().describe("Full text description of Ocean Transportation Charges, can include multiple options."),
});
export type ExtractQuotationRatesOutput = z.infer<typeof QuotationRatesSchema>;


export async function extractQuotationRates(
  input: ExtractQuotationRatesInput
): Promise<ExtractQuotationRatesOutput> {
  return extractQuotationRatesFlow(input);
}

const extractQuotationRatesPrompt = ai.definePrompt({
  name: 'extractQuotationRatesPrompt',
  input: { schema: ExtractQuotationRatesInputSchema },
  output: { schema: QuotationRatesSchema },
  prompt: `You are an expert in analyzing Cargomen quotation documents.
Analyze the provided quotation PDF (specifically sections like "Air Import Clearance" and "OCEAN Import Clearance") and extract the rates and descriptions for the following charges.
Focus on the FIRST PAGE or relevant rate schedule pages.

For each charge (Service Charges, Loading/Unloading Charges, Transportation Charges) under both Air and Ocean sections:
1.  **Rate (\`*Rate\`)**: If a fixed monetary value or a minimum fixed monetary value is explicitly stated (e.g., "Rs.4000", "Min. Rs.4000", "Rs. 200", "Min of Rs. 200", "3500 INR"), extract that NUMERIC value.
    *   If the charge is a percentage (e.g., "0.12% Of Assessable value"), or "At actual as per receipt", or has multiple complex conditions for a single rate field, leave the numeric \`*Rate\` field UNDEFINED.
    *   For Transportation Charges, if there are multiple rates for different load limits/types (e.g., "Load Limit 800Kg...3500 INR", "Load Limit 3 MTS...5400 INR"), try to pick the first or most common fixed numeric rate if possible for the \`*Rate\` field; otherwise, leave it undefined.
2.  **Description (\`*Description\`)**: Extract the full textual description of the charge as found in the quotation. This should always be populated.

Example for Air Service Charges:
If quotation says "0.12% Of Assessable value or Subject to Min. Rs.4000/- per BOE":
- airServiceChargeRate: 4000
- airServiceChargeDescription: "0.12% Of Assessable value or Subject to Min. Rs.4000/- per BOE"

If quotation says "Loading Charges at Airport: Rs. 0.50 per Kg Sub. to a Min of Rs. 200":
- airLoadingChargeRate: 200
- airLoadingChargeDescription: "Rs. 0.50 per Kg Sub. to a Min of Rs. 200"

If quotation says "Unloading Charges at Site: At actual as per receipt":
- airLoadingChargeRate: undefined (or not present in JSON output for this field)
- airLoadingChargeDescription: "At actual as per receipt" (This might be part of airLoadingChargeDescription if it's the same conceptual charge). You need to decide if "Unloading Charges at Site" and "Loading Charges at Airport" map to the same airLoadingCharge fields in the schema or if they are distinct. The schema has one 'airLoadingCharge'. Let's assume it covers both, or whichever is more prominent. The screenshot shows "Loading Charges at Airport" and "Unloading Charges at Site". The schema has "airLoadingChargeRate". Prioritize "Loading Charges at Airport" for this field if both exist.

If quotation has "Transportation Charges" with multiple entries like:
  "Load Limit 800Kg (CBV - Tata ACE) Lose Packing  3500 INR"
  "Load Limit 3 MTS / 14Ft (CBT-EICHER) Lose Packing 5400 INR"
- airTransportationChargeRate: 3500 (picking the first one as an example, or leave undefined if too complex to choose one)
- airTransportationChargeDescription: "Air Import Shipments Load Limit 800Kg (CBV - Tata ACE) Lose Packing 3500 INR, Load Limit 3 MTS / 14Ft (CBT-EICHER) Lose Packing 5400 INR, Load Limit 5 MTS / 17 Ft (CBT-EICHER) Lose Packing 6500 INR"

Provide the output as a JSON object matching the schema.

Quotation Document:
{{media url=quotationPdfDataUri maxPages=5}}
`,
});

const extractQuotationRatesFlow = ai.defineFlow(
  {
    name: 'extractQuotationRatesFlow',
    inputSchema: ExtractQuotationRatesInputSchema,
    outputSchema: QuotationRatesSchema,
  },
  async (input) => {
    const { output } = await extractQuotationRatesPrompt(input);
    if (!output) {
      throw new Error('AI failed to extract quotation rates.');
    }
    // Ensure all description fields are present, even if empty strings, if the parent (air/ocean) object is there.
    // The schema optional() handles if the AI omits them.
    return output;
  }
);
