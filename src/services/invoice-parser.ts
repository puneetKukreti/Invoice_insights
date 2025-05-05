// src/services/invoice-parser.ts
// Note: The core logic is now consolidated within the AI flows, specifically extract-invoice-data.ts.
// Components should directly import and use `extractInvoiceData` from '@/ai/flows/extract-invoice-data'.
// The service layer functions `parseInvoice` and `calculateInvoiceCharges` became redundant
// as the AI flow now handles direct PDF processing and combines results.

// No functions are exported from this service anymore.
// Keeping the file temporarily for context, but it can likely be deleted if no other
// non-AI related invoice processing logic is added here.

/**
 * Helper function to convert a File object to a data URI.
 * This might still be useful in the UI layer before calling the AI flow.
 * Consider moving this to a utils file if used elsewhere.
 */
export const readFileAsDataURL = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      // Ensure the reader reads as Data URL
      reader.onload = () => {
         if (typeof reader.result === 'string') {
           resolve(reader.result);
         } else {
           reject(new Error('Failed to read file as Data URL.'));
         }
      };
      reader.onerror = (error) => reject(error);
      reader.readAsDataURL(file);
    });
};
