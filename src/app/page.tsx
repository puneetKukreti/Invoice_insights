import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { InvoiceUploader } from "@/components/invoice-uploader";
import { InvoiceDataTable } from "@/components/invoice-data-table";
import { ExtractedData } from "@/types/invoice";

export default function Home() {
  const initialData: ExtractedData[] = []; // Placeholder for actual data fetching or state management

  return (
    <main className="flex min-h-screen flex-col items-center p-4 sm:p-12 md:p-24 bg-background">
      <Card className="w-full max-w-5xl shadow-lg rounded-lg">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold text-primary">Invoice Insights</CardTitle>
          <CardDescription className="text-muted-foreground">
            Upload your Cargomen invoice PDFs to extract key data and generate an Excel report.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          <InvoiceUploader />
          <InvoiceDataTable initialData={initialData} />
        </CardContent>
      </Card>
    </main>
  );
}
