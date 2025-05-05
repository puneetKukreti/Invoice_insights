"use client";

import React, { useState, useCallback, useTransition } from 'react';
import { useDropzone } from 'react-dropzone';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { UploadCloud, FileCheck, AlertCircle, Loader2 } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { extractInvoiceData } from '@/ai/flows/extract-invoice-data'; // Import the consolidated AI flow
import { readFileAsDataURL } from '@/services/invoice-parser'; // Import the helper
import { useInvoiceData } from '@/context/invoice-data-context'; // Import context hook
import type { ExtractedData } from '@/types/invoice'; // Import the type

export function InvoiceUploader() {
  const [files, setFiles] = useState<File[]>([]);
  const [isPending, startTransition] = useTransition();
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { addInvoiceData } = useInvoiceData(); // Use the context hook
  const { toast } = useToast();

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setError(null); // Clear previous errors
    const pdfFiles = acceptedFiles.filter(file => file.type === 'application/pdf');
    if (pdfFiles.length !== acceptedFiles.length) {
       setError("Only PDF files are accepted.");
       // Optionally filter out non-PDFs or keep only PDFs
       // setFiles(prevFiles => [...prevFiles, ...pdfFiles]);
       // For now, we accept them all and let the loop handle potential issues if needed,
       // but it's cleaner to only add PDFs. Let's refine this:
       const newValidFiles = pdfFiles.filter(pdfFile => !files.some(existingFile => existingFile.name === pdfFile.name));
       setFiles(prevFiles => [...prevFiles, ...newValidFiles]);
    } else {
       const newValidFiles = acceptedFiles.filter(file => !files.some(existingFile => existingFile.name === file.name));
       setFiles(prevFiles => [...prevFiles, ...newValidFiles]);
    }
  }, [files]); // Added files dependency to prevent duplicates in the same drop

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    multiple: true,
  });

  const handleUpload = () => {
    if (files.length === 0) {
      setError("Please select at least one PDF file to upload.");
      return;
    }

    setError(null);
    setProgress(0); // Initialize progress

    startTransition(async () => {
      const totalFiles = files.length;
      let processedFiles = 0;
      const allExtractedData: ExtractedData[] = [];
      let processingErrorOccurred = false;

      for (const file of files) {
        try {
          console.log(`Processing file: ${file.name}`);
          const fileDataUri = await readFileAsDataURL(file);

          // Ensure the Data URI has the correct MIME type prefix for PDF
          if (!fileDataUri.startsWith('data:application/pdf;base64,')) {
             console.warn(`File ${file.name} did not read as PDF data URI, attempting to fix.`);
             // Attempt to fix if it's just missing the prefix but looks like base64
             if (fileDataUri.startsWith('data:;base64,')) {
                // Or handle other common incorrect types if necessary
                // For now, assume it should be PDF
                fileDataUri = fileDataUri.replace('data:;base64,', 'data:application/pdf;base64,');
                 throw new Error(`File ${file.name} has incorrect data URI prefix. Expected 'data:application/pdf;base64,'.`);
             } else {
                throw new Error(`File ${file.name} could not be read as a valid PDF data URI.`);
             }
          }


          console.log(`Calling AI flow for ${file.name}...`);
          // Pass both data URI and filename to the flow wrapper
          const extractedData = await extractInvoiceData({
             invoicePdfDataUri: fileDataUri,
             filename: file.name // Pass filename here
          });


          if (extractedData) {
              console.log(`Successfully extracted data for ${file.name}:`, extractedData);
             // Filename is now handled within the extractInvoiceData function/flow
            allExtractedData.push(extractedData);
          } else {
             // This case might not happen if the flow throws an error, but good to keep
            throw new Error(`AI flow returned empty response for ${file.name}.`);
          }

        } catch (err) {
           processingErrorOccurred = true;
           console.error(`Error processing file ${file.name}:`, err);
           const errorMessage = err instanceof Error ? err.message : "An unknown error occurred.";
           setError(`Error processing ${file.name}: ${errorMessage}. Please check the file or try again.`);
           toast({
             title: `Error processing ${file.name}`,
             description: errorMessage,
             variant: "destructive",
           });
           // Stop processing further files on error? Or continue? Let's continue for now.
           // If stopping:
           // setProgress(null); // Stop progress indication
           // return;
        } finally {
            processedFiles++;
            // Update progress even if there was an error for this file
            setProgress(Math.round((processedFiles / totalFiles) * 100));
        }
      }

      // Add successfully extracted data to the context
      if (allExtractedData.length > 0) {
         addInvoiceData(allExtractedData);
      }

      setProgress(null); // Reset progress meter

      if (!processingErrorOccurred) {
          toast({
            title: "Processing Complete",
            description: `${totalFiles} invoice(s) processed successfully.`,
          });
          setFiles([]); // Clear files only if all processed successfully
      } else {
          toast({
              title: "Processing Finished with Errors",
              description: `Processed ${totalFiles} file(s). ${allExtractedData.length} succeeded, ${totalFiles - allExtractedData.length} failed. Please review errors.`,
              variant: "destructive",
          });
          // Keep failed files in the list? Or remove successful ones?
          // Let's remove the successfully processed ones.
          const successfulFilenames = new Set(allExtractedData.map(d => d.filename).filter((name): name is string => !!name));
          setFiles(currentFiles => currentFiles.filter(f => !successfulFilenames.has(f.name)));

      }
    });
  };

  const removeFile = (fileName: string) => {
    setFiles(files.filter(file => file.name !== fileName));
     if (files.length === 1) setError(null); // Clear error if last file removed
  };

  return (
    <div className="space-y-4">
      <div
        {...getRootProps()}
        className={`flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-lg cursor-pointer transition-colors
                   ${isDragActive ? 'border-primary bg-accent' : 'border-border hover:border-primary/50'}`}
      >
        <input {...getInputProps()} />
        <UploadCloud className="w-12 h-12 text-muted-foreground mb-4" />
        {isDragActive ? (
          <p className="text-lg font-semibold text-primary">Drop the PDF files here ...</p>
        ) : (
          <p className="text-lg text-center text-muted-foreground">
            Drag & drop Cargomen invoice PDFs here, or click to select files
          </p>
        )}
        <p className="text-sm text-muted-foreground mt-2">(Multiple PDF files accepted)</p>
      </div>

      {files.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-md font-medium">Selected Files:</h4>
          <ul className="list-disc list-inside space-y-1 max-h-40 overflow-y-auto p-2 border rounded-md bg-muted/50">
            {files.map((file, index) => (
              <li key={`${file.name}-${index}`} className="text-sm flex justify-between items-center group">
                <span className="truncate mr-2 flex-1">{file.name}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="opacity-50 group-hover:opacity-100 text-destructive hover:text-destructive px-1 h-6"
                  onClick={(e) => { e.stopPropagation(); removeFile(file.name); }}
                  aria-label={`Remove ${file.name}`}
                >
                  &times;
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}

       {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {progress !== null && (
        <div className="space-y-2 pt-2">
           <Progress value={progress} className="w-full h-2" />
           <p className="text-sm text-center text-muted-foreground">Processing... {progress}%</p>
        </div>
      )}

      <Button
        onClick={handleUpload}
        disabled={isPending || files.length === 0}
        className="w-full"
        size="lg"
      >
        {isPending ? (
          <>
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Processing Invoices...
          </>
        ) : (
          <>
            <FileCheck className="mr-2 h-5 w-5" />
            Analyze {files.length || ''} {files.length === 1 ? 'Invoice' : 'Invoices'}
          </>
        )}
      </Button>
    </div>
  );
}

// Required for Dropzone with Next.js App Router
InvoiceUploader.displayName = 'InvoiceUploader';
