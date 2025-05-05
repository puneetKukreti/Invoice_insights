"use client";

import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Download } from 'lucide-react';
import * as XLSX from 'xlsx';
import { useInvoiceData } from '@/context/invoice-data-context'; // Import context hook
import type { ExtractedData } from '@/types/invoice';

interface InvoiceDataTableProps {
  initialData?: ExtractedData[]; // Optional initial data prop
}

export function InvoiceDataTable({ initialData = [] }: InvoiceDataTableProps) {
  const { invoiceData, clearInvoiceData } = useInvoiceData(); // Get data and clear function from context

  // Use context data if available, otherwise fallback to initialData
  const dataToDisplay = invoiceData.length > 0 ? invoiceData : initialData;

  const handleExport = () => {
    if (dataToDisplay.length === 0) {
        // Optionally show a toast or message
        console.warn("No data to export.");
        return;
    }
    // Define the headers based on the ExtractedData type keys, excluding 'filename', with updated names and new Total column
    const headers = [
        "Invoice Date",
        "Invoice No",
        "HAWB No",
        "Terms of Invoice",
        "Job Number",
        "Cargomen Own Charges(Loading,unloading,Agency Charges,Transportation If any)", // Updated header
        "REIMBURSEMENT Charges(Storage Charge,Do charges,Celebi ..ect)", // Updated header
        "Total Charges (Incl. Tax)", // New header
        "Source File",
    ];

    // Map data to the desired format, ensuring order matches headers and including total
     const dataForSheet = dataToDisplay.map(item => ({
        "Invoice Date": item.invoiceDate,
        "Invoice No": item.invoiceNumber,
        "HAWB No": item.hawbNumber,
        "Terms of Invoice": item.termsOfInvoice,
        "Job Number": item.jobNumber,
        "Cargomen Own Charges(Loading,unloading,Agency Charges,Transportation If any)": item.cargomenOwnCharges, // Match header
        "REIMBURSEMENT Charges(Storage Charge,Do charges,Celebi ..ect)": item.reimbursementCharges, // Match header
        "Total Charges (Incl. Tax)": item.cargomenOwnCharges + item.reimbursementCharges, // Calculate total
        "Source File": item.filename || 'N/A',
    }));


    const worksheet = XLSX.utils.json_to_sheet(dataForSheet, { header: headers });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Invoice Data");

    // Buffer to handle large data sets (optional but good practice)
    // XLSX.write(workbook, { bookType: "xlsx", type: "buffer" });

    // Generate file and trigger download
    XLSX.writeFile(workbook, "InvoiceInsights_Export.xlsx");
  };

  return (
    <div className="space-y-4">
       <div className="flex justify-between items-center">
         <h3 className="text-xl font-semibold">Extracted Invoice Data</h3>
         <div className="flex gap-2">
             {dataToDisplay.length > 0 && (
                 <Button variant="outline" onClick={clearInvoiceData}>
                   Clear Data
                 </Button>
             )}
            <Button onClick={handleExport} disabled={dataToDisplay.length === 0}>
              <Download className="mr-2 h-4 w-4" />
              Export to Excel
            </Button>
         </div>
      </div>
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invoice Date</TableHead>
              <TableHead>Invoice No</TableHead>
              <TableHead>HAWB No</TableHead>
              <TableHead>Terms</TableHead>
              <TableHead>Job No</TableHead>
              {/* Updated Table Headings */}
              <TableHead className="text-right">Cargomen Own Charges<br/>(Loading,unloading,Agency Charges,Transportation If any)</TableHead>
              <TableHead className="text-right">REIMBURSEMENT Charges<br/>(Storage Charge,Do charges,Celebi ..ect)</TableHead>
              <TableHead className="text-right font-bold">Total Charges<br/>(Incl. Tax)</TableHead> {/* New Total Column Header */}
              <TableHead>Source File</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {dataToDisplay.length === 0 ? (
              <TableRow>
                {/* Updated ColSpan */}
                <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
                  Upload invoices to see the extracted data here.
                </TableCell>
              </TableRow>
            ) : (
              dataToDisplay.map((invoice, index) => {
                const totalCharges = invoice.cargomenOwnCharges + invoice.reimbursementCharges;
                return (
                    <TableRow key={invoice.invoiceNumber + index}> {/* Added index for more robust key */}
                    <TableCell>{invoice.invoiceDate}</TableCell>
                    <TableCell>{invoice.invoiceNumber}</TableCell>
                    <TableCell>{invoice.hawbNumber}</TableCell>
                    <TableCell>{invoice.termsOfInvoice}</TableCell>
                    <TableCell>{invoice.jobNumber}</TableCell>
                    <TableCell className="text-right">{invoice.cargomenOwnCharges.toFixed(2)}</TableCell>
                    <TableCell className="text-right">{invoice.reimbursementCharges.toFixed(2)}</TableCell>
                    {/* New Total Column Data */}
                    <TableCell className="text-right font-bold">{totalCharges.toFixed(2)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground truncate max-w-[150px]">{invoice.filename || 'N/A'}</TableCell>
                    </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
