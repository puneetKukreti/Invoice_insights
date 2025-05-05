'use server';

/**
 * @fileOverview Classifies invoice charges into 'Cargomen Own Charges' and 'Reimbursement Charges'.
 *
 * - classifyInvoiceCharges - A function that classifies invoice charges.
 * - ClassifyInvoiceChargesInput - The input type for the classifyInvoiceCharges function.
 * - ClassifyInvoiceChargesOutput - The return type for the classifyInvoiceCharges function.
 */

import {ai} from '@/ai/ai-instance';
import {Invoice} from '@/services/invoice-parser';
import {z} from 'genkit';

const ClassifyInvoiceChargesInputSchema = z.object({
  invoice: z.any().describe('The invoice data.'),
  invoiceText: z.string().describe('The full text content of the invoice.'),
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
    schema: z.object({
      invoiceText: z.string().describe('The full text content of the invoice.'),
    }),
  },
  output: {
    schema: z.object({
      cargomenOwnCharges: z.number().describe('The sum of Cargomen own charges.'),
      reimbursementCharges: z.number().describe('The sum of reimbursement charges.'),
    }),
  },
  prompt: `You are an expert in invoice processing. Your task is to classify charges from an invoice into two categories:

  1. Cargomen Own Charges: This includes charges directly related to Cargomen's services such as service charges, loading & unloading, and transportation.
  2. Reimbursement Charges: This includes charges that Cargomen pays to third parties on behalf of the customer, such as custodian charges, DO charges, Celebi charges, storage charges, airline terminal handling, and other reimbursable charges.

  Analyze the following invoice text and determine the total Cargomen Own Charges and the total Reimbursement Charges.  If a charge is ambiguous, use keywords and context to classify it correctly.  Correct any OCR noise in the invoice text before attempting to calculate the charges.

  Invoice Text:
  {{invoiceText}}

  Provide the total Cargomen Own Charges and the total Reimbursement Charges as a JSON object.
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
    const {output} = await classifyInvoiceChargesPrompt({
      invoiceText: input.invoiceText,
    });
    return output!;
  }
);
