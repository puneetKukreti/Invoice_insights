import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { InvoiceUploader } from "@/components/invoice-uploader";
import { InvoiceDataTable } from "@/components/invoice-data-table";
import { QuotationUploader } from "@/components/quotation-uploader"; // Import QuotationUploader
import { Separator } from "@/components/ui/separator";

export default function Home() {

  return (
    <main className="flex min-h-screen flex-col items-center p-4 sm:p-12 md:p-24 bg-background">
      <Card className="w-full max-w-5xl shadow-lg rounded-lg">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold text-primary">Invoice Insights</CardTitle>
          <CardDescription className="text-muted-foreground">
            Upload Cargomen invoice PDFs to extract data and compare with your quotation.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <InvoiceUploader />
            <QuotationUploader />
          </div>
          <Separator />
          <InvoiceDataTable />
        </CardContent>
      </Card>
    </main>
  );
}
