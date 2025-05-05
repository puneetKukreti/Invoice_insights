// src/services/invoice-parser.ts
import { classifyInvoiceCharges, ClassifyInvoiceChargesOutput } from '@/ai/flows/classify-invoice-charges';
import { extractInvoiceData, ExtractInvoiceDataOutput } from '@/ai/flows/extract-invoice-data';

/**
 * Represents a generic invoice with common fields based on AI extraction.
 * Matches the fields returned by extractInvoiceData AI flow (excluding charges).
 */
export interface Invoice {
  invoiceDate: string;
  invoiceNumber: string;
  hawbNumber: string;
  termsOfInvoice: string;
  jobNumber: string;
}

/**
 * Represents the charges associated with an invoice, based on AI classification.
 * Matches the fields returned by classifyInvoiceCharges AI flow.
 */
export interface InvoiceCharges {
  cargomenOwnCharges: number;
  reimbursementCharges: number;
}

/**
 * Helper function to convert a File object to a data URI.
 */
const readFileAsDataURL = (file: File): Promise<string> => {
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

/**
 * Helper function to convert a File object to text.
 */
const readFileAsText = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            if (typeof reader.result === 'string') {
                resolve(reader.result);
            } else {
                // Handle ArrayBuffer case if needed, though less likely for text
                reject(new Error('Failed to read file as text.'));
            }
        };
        reader.onerror = (error) => reject(error);
        reader.readAsText(file); // Read as text
    });
};


/**
 * Asynchronously parses an invoice PDF using the extractInvoiceData AI flow.
 *
 * @param invoicePdf The PDF file of the invoice.
 * @returns A promise that resolves to an Invoice object containing extracted data (excluding charges).
 */
export async function parseInvoice(invoicePdf: File): Promise<Invoice> {
  try {
    const invoicePdfDataUri = await readFileAsDataURL(invoicePdf);
    // We call extractInvoiceData which now includes charge calculation internally if needed,
    // but this function specifically returns only the Invoice base fields.
    const fullExtractedData: ExtractInvoiceDataOutput = await extractInvoiceData({ invoicePdfDataUri });

    // Return only the fields relevant to the Invoice interface
    return {
      invoiceDate: fullExtractedData.invoiceDate,
      invoiceNumber: fullExtractedData.invoiceNumber,
      hawbNumber: fullExtractedData.hawbNumber,
      termsOfInvoice: fullExtractedData.termsOfInvoice,
      jobNumber: fullExtractedData.jobNumber,
    };
  } catch (error) {
    console.error("Error parsing invoice using AI:", error);
    // Provide default values or re-throw, depending on desired error handling
     throw new Error(`Failed to parse invoice ${invoicePdf.name}: ${error instanceof Error ? error.message : 'Unknown AI error'}`);
  }
}

/**
 * Asynchronously calculates the charges associated with an invoice using the classifyInvoiceCharges AI flow.
 * Note: This might become redundant if extractInvoiceData handles everything,
 * but kept separate for potential direct charge classification needs.
 *
 * @param invoicePdf The PDF file of the invoice.
 * @returns A promise that resolves to an InvoiceCharges object containing calculated charges.
 */
export async function calculateInvoiceCharges(invoicePdf: File): Promise<InvoiceCharges> {
   try {
       // The classifyInvoiceCharges flow needs the invoice text.
       // In a real scenario, you'd extract text from the PDF here.
       // For now, we'll simulate getting text. A proper implementation
       // would use a PDF text extraction library (like pdf-parse on the server)
       // or potentially pass the PDF data URI to an AI model capable of direct PDF processing.

       // Placeholder: Simulate extracting text or potentially rely on the data already extracted
       // If parseInvoice was called first, we might have the data.
       // However, the classify flow *specifically* asks for invoiceText.
       // Let's assume we need to extract text separately for this function.
        // const invoiceText = await readFileAsText(invoicePdf); // This reads the PDF as raw text, likely needs proper extraction
         const invoiceText = "Simulated invoice text - replace with actual PDF text extraction"; // Placeholder

        // Since parseInvoice might already have the structured data, ideally,
        // classifyInvoiceCharges would take the structured Invoice object too.
        // Let's assume parseInvoice needs to be called to get basic info first.
        // This indicates a potential refactor needed in the AI flow design or service layer.
        const basicInvoiceData = await parseInvoice(invoicePdf); // Get basic data first

        const classificationInput = {
            invoice: basicInvoiceData, // Pass the structured data
            invoiceText: invoiceText, // Pass the extracted text (placeholder)
        };

       const charges: ClassifyInvoiceChargesOutput = await classifyInvoiceCharges(classificationInput);

       return {
           cargomenOwnCharges: charges.cargomenOwnCharges,
           reimbursementCharges: charges.reimbursementCharges,
       };

   } catch (error) {
       console.error("Error calculating invoice charges using AI:", error);
       throw new Error(`Failed to calculate charges for ${invoicePdf.name}: ${error instanceof Error ? error.message : 'Unknown AI error'}`);
   }
}
