// src/components/invoice-data-table.tsx
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
import { useInvoiceData } from '@/context/invoice-data-context';
import type { ExtractedData } from '@/types/invoice';

interface InvoiceDataTableProps {
  initialData?: ExtractedData[];
}

export function InvoiceDataTable({ initialData = [] }: InvoiceDataTableProps) {
  const { invoiceData, clearInvoiceData } = useInvoiceData();

  const dataToDisplay = invoiceData.length > 0 ? invoiceData : initialData;

  const handleExport = () => {
    if (dataToDisplay.length === 0) {
        console.warn("No data to export.");
        return;
    }
    const headers = [
        "Invoice Date",
        "Invoice No",
        "AWB/BL No",
        "Terms of Invoice",
        "Job Number",
        "Service Charges (Incl. Tax)",
        "L&U Charges (Incl. Tax)",
        "Transport Charges (Incl. Tax)",
        "Reimbursement Charges (Incl. Tax)",
        "Total Charges (Incl. Tax)",
        "Source File",
    ];

     const dataForSheet = dataToDisplay.map(item => ({
        "Invoice Date": item.invoiceDate,
        "Invoice No": item.invoiceNumber,
        "AWB/BL No": item.hawbNumber,
        "Terms of Invoice": item.termsOfInvoice,
        "Job Number": item.jobNumber,
        "Service Charges (Incl. Tax)": item.serviceCharges,
        "L&U Charges (Incl. Tax)": item.loadingUnloadingCharges,
        "Transport Charges (Incl. Tax)": item.transportationCharges,
        "Reimbursement Charges (Incl. Tax)": item.reimbursementCharges,
        "Total Charges (Incl. Tax)": item.serviceCharges + item.loadingUnloadingCharges + item.transportationCharges + item.reimbursementCharges,
        "Source File": item.filename || 'N/A',
    }));


    const worksheet = XLSX.utils.json_to_sheet(dataForSheet, { header: headers });
    const workbook = XLSX.utils.book_new();

    const range = XLSX.utils.decode_range(worksheet['!ref']!);
    for (let R = range.s.r; R <= range.e.r; ++R) {
      for (let C = range.s.c; C <= range.e.c; ++C) {
        const cellref = XLSX.utils.encode_cell({ r: R, c: C });
        if (!worksheet[cellref]) continue;

        if (!worksheet[cellref].s) worksheet[cellref].s = {};
        worksheet[cellref].s.border = {
          top: { style: "thin" },
          bottom: { style: "thin" },
          left: { style: "thin" },
          right: { style: "thin" },
        };

        if (R === 0) {
          if (!worksheet[cellref].s.fill) worksheet[cellref].s.fill = {};
          worksheet[cellref].s.fill = {
            fgColor: { rgb: "E0E0E0" }
          };
          worksheet[cellref].s.font = { bold: true };
        }

        // Wrap text for Reimbursement Charges and Source File columns
        const wrapColumns = [8, 10]; // Indices for Reimbursement Charges, Source File
        if (wrapColumns.includes(C)) {
          if (!worksheet[cellref].s.alignment) worksheet[cellref].s.alignment = {};
          worksheet[cellref].s.alignment.wrapText = true;
        }
      }
    }

    worksheet['!cols'] = [
        {wch: 15}, {wch: 15}, {wch: 15}, {wch: 15}, {wch: 15}, // Date, Inv No, AWB, Terms, Job No
        {wch: 20}, {wch: 20}, {wch: 20}, // Service, L&U, Transport
        {wch: 30}, // Reimbursement
        {wch: 20}, // Total
        {wch: 30}  // Source File
    ];

    XLSX.utils.book_append_sheet(workbook, worksheet, "Invoice Data");
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
              <TableHead>AWB/BL No</TableHead>
              <TableHead>Terms</TableHead>
              <TableHead>Job No</TableHead>
              <TableHead className="text-right">Service Charges<br/>(Incl. Tax)</TableHead>
              <TableHead className="text-right">L&U Charges<br/>(Incl. Tax)</TableHead>
              <TableHead className="text-right">Transport Charges<br/>(Incl. Tax)</TableHead>
              <TableHead className="text-right">Reimbursement Charges<br/>(Storage, DO, Celebi etc.)</TableHead>
              <TableHead className="text-right font-bold">Total Charges<br/>(Incl. Tax)</TableHead>
              <TableHead>Source File</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {dataToDisplay.length === 0 ? (
              <TableRow>
                <TableCell colSpan={11} className="h-24 text-center text-muted-foreground">
                  Upload invoices to see the extracted data here.
                </TableCell>
              </TableRow>
            ) : (
              dataToDisplay.map((invoice, index) => {
                const totalCharges = invoice.serviceCharges + invoice.loadingUnloadingCharges + invoice.transportationCharges + invoice.reimbursementCharges;
                return (
                    <TableRow key={`${invoice.invoiceNumber}-${invoice.filename || index}`}>
                      <TableCell>{invoice.invoiceDate}</TableCell>
                      <TableCell>{invoice.invoiceNumber}</TableCell>
                      <TableCell>{invoice.hawbNumber}</TableCell>
                      <TableCell>{invoice.termsOfInvoice}</TableCell>
                      <TableCell>{invoice.jobNumber}</TableCell>
                      <TableCell className="text-right">{invoice.serviceCharges.toFixed(2)}</TableCell>
                      <TableCell className="text-right">{invoice.loadingUnloadingCharges.toFixed(2)}</TableCell>
                      <TableCell className="text-right">{invoice.transportationCharges.toFixed(2)}</TableCell>
                      <TableCell className="text-right">{invoice.reimbursementCharges.toFixed(2)}</TableCell>
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
