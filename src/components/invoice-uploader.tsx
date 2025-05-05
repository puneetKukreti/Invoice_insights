"use client";

import React, { useState, useCallback, useTransition } from 'react';
import { useDropzone } from 'react-dropzone';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { UploadCloud, FileCheck, AlertCircle, Loader2 } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { extractInvoiceData } from '@/ai/flows/extract-invoice-data'; // Assuming AI flow exists
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
    }
    setFiles(prevFiles => [...prevFiles, ...pdfFiles]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    multiple: true,
  });

   const readFileAsDataURL = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
      reader.readAsDataURL(file);
    });
  };

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

      for (const file of files) {
        try {
          const fileDataUri = await readFileAsDataURL(file);
          const extractedData = await extractInvoiceData({ invoicePdfDataUri: fileDataUri });

          if (extractedData) {
              // Add filename to the extracted data
             const dataWithFilename: ExtractedData = {
               ...extractedData,
               filename: file.name, // Add the filename here
             };
            allExtractedData.push(dataWithFilename);
          } else {
            throw new Error(`Failed to extract data from ${file.name}. AI response was empty.`);
          }

          processedFiles++;
          setProgress(Math.round((processedFiles / totalFiles) * 100));

        } catch (err) {
           console.error(`Error processing file ${file.name}:`, err);
           setError(`Error processing ${file.name}. Please check the console for details.`);
           toast({
             title: `Error processing ${file.name}`,
             description: err instanceof Error ? err.message : "An unknown error occurred.",
             variant: "destructive",
           });
           setProgress(null); // Stop progress on error
           return; // Stop processing further files on error
        }
      }

      // Add all extracted data to the context at once
      addInvoiceData(allExtractedData);

      toast({
        title: "Processing Complete",
        description: `${totalFiles} invoice(s) processed successfully.`,
      });
      setFiles([]); // Clear files after successful upload and processing
      setProgress(null); // Reset progress
    });
  };

  const removeFile = (fileName: string) => {
    setFiles(files.filter(file => file.name !== fileName));
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
        <p className="text-sm text-muted-foreground mt-2">(Multiple files accepted)</p>
      </div>

      {files.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-md font-medium">Selected Files:</h4>
          <ul className="list-disc list-inside space-y-1 max-h-40 overflow-y-auto p-2 border rounded-md">
            {files.map((file, index) => (
              <li key={index} className="text-sm flex justify-between items-center group">
                <span className="truncate mr-2">{file.name}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive"
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
        <div className="space-y-2">
           <Progress value={progress} className="w-full" />
           <p className="text-sm text-center text-muted-foreground">Processing... {progress}%</p>
        </div>
      )}

      <Button
        onClick={handleUpload}
        disabled={isPending || files.length === 0}
        className="w-full"
      >
        {isPending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Processing...
          </>
        ) : (
          <>
            <FileCheck className="mr-2 h-4 w-4" />
            Analyze Invoices
          </>
        )}
      </Button>
    </div>
  );
}

// Required for Dropzone with Next.js App Router
InvoiceUploader.displayName = 'InvoiceUploader';
