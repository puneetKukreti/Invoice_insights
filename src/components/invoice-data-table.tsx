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
import { Download, AlertTriangle, CheckCircle, HelpCircle } from 'lucide-react';
import * as XLSX from 'xlsx';
import { useInvoiceData } from '@/context/invoice-data-context';
import { useQuotation } from '@/context/quotation-context'; // Import quotation context
import type { ExtractedData, QuotationRates } from '@/types/invoice';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';


// Helper function to compare invoice charges with quotation rates
const compareCharges = (invoice: ExtractedData, rates: QuotationRates | null): ExtractedData['comparisonStatus'] => {
  if (!rates) return 'no_quotation_data';
  if (invoice.shipmentType === 'unknown') return 'invoice_type_unknown';

  let serviceChargeMatch = true; // Default to true if not applicable or matches
  let loadingChargeMatch = true;  // Default to true if not applicable or matches
  // Transportation charge comparison is complex due to varied rates, so we'll focus on service and loading for row coloring.
  // We can still display the extracted transportation charge.

  const invoiceServiceActual = invoice.serviceChargesActual ?? 0;
  const invoiceLoadingActual = invoice.loadingChargesActual ?? 0;

  if (invoice.shipmentType === 'air') {
    if (rates.airServiceChargeRate !== undefined && invoiceServiceActual > rates.airServiceChargeRate) {
      serviceChargeMatch = false;
    }
    if (rates.airLoadingChargeRate !== undefined && invoiceLoadingActual > rates.airLoadingChargeRate) {
      loadingChargeMatch = false;
    }
    if (rates.airServiceChargeRate === undefined && rates.airLoadingChargeRate === undefined) return 'not_comparable_charges';

  } else if (invoice.shipmentType === 'ocean') {
    if (rates.oceanServiceChargeRate !== undefined && invoiceServiceActual > rates.oceanServiceChargeRate) {
      serviceChargeMatch = false;
    }
    if (rates.oceanLoadingChargeRate !== undefined && invoiceLoadingActual > rates.oceanLoadingChargeRate) {
      loadingChargeMatch = false;
    }
    if (rates.oceanServiceChargeRate === undefined && rates.oceanLoadingChargeRate === undefined) return 'not_comparable_charges';
  }

  return serviceChargeMatch && loadingChargeMatch ? 'matched' : 'mismatched';
};


export function InvoiceDataTable() {
  const { invoiceData, clearInvoiceData } = useInvoiceData();
  const { quotationRates } = useQuotation(); // Get quotation rates from context

  // Enhance invoice data with comparison status
  const dataToDisplay = React.useMemo(() => {
    return invoiceData.map(invoice => ({
      ...invoice,
      comparisonStatus: compareCharges(invoice, quotationRates),
    }));
  }, [invoiceData, quotationRates]);


  const handleExport = () => {
    if (dataToDisplay.length === 0) {
        console.warn("No data to export.");
        return;
    }
    const headers = [
        "Status",
        "Invoice Date",
        "Invoice No",
        "AWB/BL No",
        "Terms of Invoice",
        "Job Number",
        "Shipment Type",
        "Actual Service Charges (Inv)",
        "Actual Loading Charges (Inv)",
        "Actual Transportation Charges (Inv)",
        "Cargomen Own Charges (Total)",
        "REIMBURSEMENT Charges (Total)",
        "Total Charges (Incl. Tax)",
        "Source File",
    ];

     const dataForSheet = dataToDisplay.map(item => ({
        "Status": item.comparisonStatus || 'N/A',
        "Invoice Date": item.invoiceDate,
        "Invoice No": item.invoiceNumber,
        "AWB/BL No": item.hawbNumber,
        "Terms of Invoice": item.termsOfInvoice,
        "Job Number": item.jobNumber,
        "Shipment Type": item.shipmentType || 'unknown',
        "Actual Service Charges (Inv)": item.serviceChargesActual?.toFixed(2) || '0.00',
        "Actual Loading Charges (Inv)": item.loadingChargesActual?.toFixed(2) || '0.00',
        "Actual Transportation Charges (Inv)": item.transportationChargesActual?.toFixed(2) || '0.00',
        "Cargomen Own Charges (Total)": item.cargomenOwnCharges.toFixed(2),
        "REIMBURSEMENT Charges (Total)": item.reimbursementCharges.toFixed(2),
        "Total Charges (Incl. Tax)": (item.cargomenOwnCharges + item.reimbursementCharges).toFixed(2),
        "Source File": item.filename || 'N/A',
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataForSheet, { header: headers });
    const workbook = XLSX.utils.book_new();
    // Styling (same as before)
    const range = XLSX.utils.decode_range(worksheet['!ref']!);
    for (let R = range.s.r; R <= range.e.r; ++R) {
      for (let C = range.s.c; C <= range.e.c; ++C) {
        const cellref = XLSX.utils.encode_cell({ r: R, c: C });
        if (!worksheet[cellref]) continue;
        if (!worksheet[cellref].s) worksheet[cellref].s = {};
        worksheet[cellref].s.border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" }};
        if (R === 0) {
          worksheet[cellref].s.fill = { fgColor: { rgb: "E0E0E0" } };
          worksheet[cellref].s.font = { bold: true };
        }
        const wrapColumns = [10, 11, 13]; // Indices for Cargomen Total, Reimbursement Total, Source File
        if (wrapColumns.includes(C)) {
          if (!worksheet[cellref].s.alignment) worksheet[cellref].s.alignment = {};
          worksheet[cellref].s.alignment.wrapText = true;
        }
      }
    }
    worksheet['!cols'] = [ {wch: 15}, {wch: 15}, {wch: 15}, {wch: 15}, {wch: 15}, {wch: 20}, {wch: 15}, {wch: 20}, {wch: 20}, {wch: 25}, {wch: 25}, {wch: 25}, {wch: 20}, {wch: 30}];
    XLSX.utils.book_append_sheet(workbook, worksheet, "Invoice Data");
    XLSX.writeFile(workbook, "InvoiceInsights_Export.xlsx");
  };

  const getStatusIcon = (status?: ExtractedData['comparisonStatus']) => {
    switch (status) {
      case 'matched':
        return <TooltipTrigger asChild><CheckCircle className="h-5 w-5 text-green-500" /></TooltipTrigger>;
      case 'mismatched':
        return <TooltipTrigger asChild><AlertTriangle className="h-5 w-5 text-red-500" /></TooltipTrigger>;
      case 'no_quotation_data':
      case 'invoice_type_unknown':
      case 'not_comparable_charges':
      default:
        return <TooltipTrigger asChild><HelpCircle className="h-5 w-5 text-yellow-500" /></TooltipTrigger>;
    }
  };

  const getStatusTooltip = (status?: ExtractedData['comparisonStatus']) => {
    switch (status) {
      case 'matched':
        return "Invoice charges for Service & Loading are within or equal to quoted rates.";
      case 'mismatched':
        return "Invoice charges for Service and/or Loading exceed quoted rates.";
      case 'no_quotation_data':
        return "No quotation data loaded for comparison.";
      case 'invoice_type_unknown':
        return "Shipment type (Air/Ocean) for this invoice could not be determined.";
      case 'not_comparable_charges':
        return "Quotation rates for this shipment type are not fixed (e.g., % based or 'at actual'). Comparison not applied for row color.";
      default:
        return "Comparison status unknown or not applicable.";
    }
  }

  return (
    <TooltipProvider>
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
              <TableHead className="w-[50px]">Status</TableHead>
              <TableHead>Invoice Date</TableHead>
              <TableHead>Invoice No</TableHead>
              <TableHead>AWB/BL No</TableHead>
              <TableHead>Terms</TableHead>
              <TableHead>Job No</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Service Ch. (Actual)</TableHead>
              <TableHead className="text-right">Loading Ch. (Actual)</TableHead>
              <TableHead className="text-right">Transport Ch. (Actual)</TableHead>
              <TableHead className="text-right">Cargomen Own Charges (Total)</TableHead>
              <TableHead className="text-right">REIMBURSEMENT Charges (Total)</TableHead>
              <TableHead className="text-right font-bold">Total Charges (Inv)</TableHead>
              <TableHead>Source File</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {dataToDisplay.length === 0 ? (
              <TableRow>
                <TableCell colSpan={14} className="h-24 text-center text-muted-foreground">
                  Upload invoices to see the extracted data here. Upload a quotation to enable comparison.
                </TableCell>
              </TableRow>
            ) : (
              dataToDisplay.map((invoice, index) => {
                const totalCharges = invoice.cargomenOwnCharges + invoice.reimbursementCharges;
                const rowClass = invoice.comparisonStatus === 'matched' ? 'bg-green-50 hover:bg-green-100' : 
                                 invoice.comparisonStatus === 'mismatched' ? 'bg-red-50 hover:bg-red-100' : '';
                return (
                    <TableRow key={`${invoice.invoiceNumber}-${invoice.filename || index}`} className={cn(rowClass)}>
                      <TableCell>
                        <Tooltip>
                            {getStatusIcon(invoice.comparisonStatus)}
                          <TooltipContent>
                            <p>{getStatusTooltip(invoice.comparisonStatus)}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TableCell>
                      <TableCell>{invoice.invoiceDate}</TableCell>
                      <TableCell>{invoice.invoiceNumber}</TableCell>
                      <TableCell>{invoice.hawbNumber}</TableCell>
                      <TableCell>{invoice.termsOfInvoice}</TableCell>
                      <TableCell>{invoice.jobNumber}</TableCell>
                      <TableCell>{invoice.shipmentType || 'N/A'}</TableCell>
                      <TableCell className="text-right">{invoice.serviceChargesActual?.toFixed(2) || '0.00'}</TableCell>
                      <TableCell className="text-right">{invoice.loadingChargesActual?.toFixed(2) || '0.00'}</TableCell>
                      <TableCell className="text-right">{invoice.transportationChargesActual?.toFixed(2) || '0.00'}</TableCell>
                      <TableCell className="text-right">{invoice.cargomenOwnCharges.toFixed(2)}</TableCell>
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
    </TooltipProvider>
  );
}
