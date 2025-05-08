"use client";

import React, { useState, useCallback, useTransition } from 'react';
import { useDropzone } from 'react-dropzone';
import { Button } from '@/components/ui/button';
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { UploadCloud, FileText, AlertCircle, Loader2, CheckCircle } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { readFileAsDataURL } from '@/services/invoice-parser';
import { useQuotation } from '@/context/quotation-context';
import { extractQuotationRates } from '@/ai/flows/extract-quotation-rates';
import type { QuotationRates } from '@/types/invoice';

export function QuotationUploader() {
  const [file, setFile] = useState<File | null>(null);
  const [isPending, startTransition] = useTransition();
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { setQuotationRates, quotationRates, clearQuotationRates } = useQuotation();
  const { toast } = useToast();

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setError(null);
    if (acceptedFiles.length > 0) {
      const firstFile = acceptedFiles[0];
      if (firstFile.type === 'application/pdf') {
        setFile(firstFile);
      } else {
        setError("Only PDF files are accepted for quotations.");
        setFile(null);
      }
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    multiple: false,
  });

  const handleProcessQuotation = () => {
    if (!file) {
      setError("Please select a quotation PDF file.");
      return;
    }

    setError(null);
    setProgress(0);

    startTransition(async () => {
      try {
        const fileDataUri = await readFileAsDataURL(file);
        setProgress(25);

        const extractedRates = await extractQuotationRates({ quotationPdfDataUri: fileDataUri });
        setProgress(75);

        if (extractedRates) {
          setQuotationRates(extractedRates);
          toast({
            title: "Quotation Processed",
            description: `Quotation "${file.name}" processed successfully.`,
            variant: "default",
          });
          // Do not clear the file here, user might want to see which one is active
        } else {
          throw new Error("AI flow returned empty response for quotation.");
        }
      } catch (err) {
        console.error(`Error processing quotation ${file.name}:`, err);
        const errorMessage = err instanceof Error ? err.message : "An unknown error occurred.";
        setError(`Error processing ${file.name}: ${errorMessage}`);
        toast({
          title: `Error processing ${file.name}`,
          description: errorMessage,
          variant: "destructive",
        });
        setQuotationRates(null); // Clear any existing rates on error
      } finally {
        setProgress(null);
      }
    });
  };

  const handleClearQuotation = () => {
    setFile(null);
    clearQuotationRates();
    setError(null);
    toast({
        title: "Quotation Cleared",
        description: "Active quotation data has been removed.",
    });
  }

  return (
    <div className="space-y-4 p-4 border rounded-lg shadow-sm bg-card">
      <h3 className="text-lg font-semibold text-primary">Upload Cargomen Quotation PDF</h3>
      {!quotationRates && (
        <div
          {...getRootProps()}
          className={`flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-lg cursor-pointer transition-colors
                     ${isDragActive ? 'border-primary bg-accent' : 'border-border hover:border-primary/50'}`}
        >
          <input {...getInputProps()} />
          <UploadCloud className="w-10 h-10 text-muted-foreground mb-3" />
          {isDragActive ? (
            <p className="text-md font-semibold text-primary">Drop the quotation PDF here...</p>
          ) : (
            <p className="text-md text-center text-muted-foreground">
              Drag & drop quotation PDF here, or click to select file
            </p>
          )}
        </div>
      )}

      {file && (
        <div className="text-sm text-muted-foreground">
          Selected file: <span className="font-medium text-foreground">{file.name}</span>
        </div>
      )}
      
      {quotationRates && file && (
        <Alert variant="default" className="bg-green-50 border-green-200">
          <CheckCircle className="h-5 w-5 text-green-600" />
          <AlertTitle className="text-green-700">Quotation Active</AlertTitle>
          <AlertDescription className="text-green-600">
            Using quotation: <strong>{file.name}</strong>. Invoice comparisons will use this data.
            <Button onClick={handleClearQuotation} variant="link" size="sm" className="text-green-700 hover:text-green-800 p-0 h-auto ml-2">Clear Quotation</Button>
          </AlertDescription>
        </Alert>
      )}


      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {progress !== null && (
        <div className="space-y-1 pt-1">
           <Progress value={progress} className="w-full h-2" />
           <p className="text-xs text-center text-muted-foreground">Processing... {progress}%</p>
        </div>
      )}

      {!quotationRates && file && (
        <Button
          onClick={handleProcessQuotation}
          disabled={isPending || !file}
          className="w-full"
        >
          {isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processing Quotation...
            </>
          ) : (
            <>
              <FileText className="mr-2 h-4 w-4" />
              Process Quotation
            </>
          )}
        </Button>
      )}
    </div>
  );
}

QuotationUploader.displayName = 'QuotationUploader';
