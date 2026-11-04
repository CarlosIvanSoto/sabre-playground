import Link from "next/link"
import {
  ArrowLeft,
  BarChart3,
  FileText,
  Info,
} from "lucide-react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import { cookies } from "next/headers"
import { SessionStatus } from "@/components/features/sabre/session-status"
import { DailySalesReportForm } from "@/components/features/sabre/daily-sales-report-form"
import { DailySalesSummaryForm } from "@/components/features/sabre/daily-sales-summary-form"

function DailySalesCard({
  title,
  description,
  icon: Icon,
  children
}: {
  title: string;
  description: string;
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <Card className="border-zinc-800 bg-zinc-950/50 backdrop-blur-sm">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-900 ring-1 ring-zinc-800">
            <Icon className="h-5 w-5 text-zinc-400" />
          </div>
          <div>
            <CardTitle className="text-xl font-medium text-zinc-100">{title}</CardTitle>
            <CardDescription className="text-zinc-400">{description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {children}
      </CardContent>
    </Card>
  )
}

export default async function DailySalesPage() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("sessionToken")?.value;
  const { token, expiresAt } = JSON.parse(sessionToken || "{}");

  return (
    <div className="min-h-screen bg-black text-white selection:bg-primary/20">
      {/* Ambient Background */}
      <div className="fixed inset-0 z-0">
        <div className="absolute -top-[20%] -left-[10%] h-[700px] w-[700px] rounded-full bg-emerald-900/10 blur-[100px]" />
        <div className="absolute -bottom-[20%] -right-[10%] h-[700px] w-[700px] rounded-full bg-zinc-900/10 blur-[100px]" />
      </div>

      <div className="relative z-10 container mx-auto px-4 py-12 max-w-7xl">
        {/* Header */}
        <div className="mb-12 space-y-4">
          <Link
            prefetch={false}
            href="/sabre"
            className="inline-flex items-center text-sm text-zinc-500 hover:text-white transition-colors gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Link>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-zinc-800 pb-8">
            <div className="space-y-2">
              <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-white via-zinc-200 to-zinc-500 bg-clip-text text-transparent">
                Daily Sales
              </h1>
              <p className="text-lg text-zinc-400 max-w-2xl">
                Consult daily sales reports and summaries by PCC and date.
              </p>
            </div>
            <div className="md:self-center">
              <SessionStatus token={token} expiresAt={expiresAt} />
            </div>
          </div>
        </div>

        {/* Main Interface */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

          {/* Left: Forms */}
          <div className="lg:col-span-8 space-y-6">
            <Tabs defaultValue="report" className="w-full">
              <TabsList className="bg-zinc-900 border border-zinc-800 mb-6">
                <TabsTrigger value="report" className="data-[state=active]:bg-zinc-800">Sales Report</TabsTrigger>
                <TabsTrigger value="summary" className="data-[state=active]:bg-zinc-800">Sales Summary</TabsTrigger>
              </TabsList>

              <TabsContent value="report">
                <DailySalesCard
                  title="Sales Report"
                  description="Retrieve the full daily sales report with issuance data for a given PCC and date."
                  icon={FileText}
                >
                  <DailySalesReportForm />
                </DailySalesCard>
              </TabsContent>

              <TabsContent value="summary">
                <DailySalesCard
                  title="Sales Summary"
                  description="Get the audit trail summary with transaction details for a given PCC and date."
                  icon={BarChart3}
                >
                  <DailySalesSummaryForm />
                </DailySalesCard>
              </TabsContent>
            </Tabs>
          </div>

          {/* Right: Info */}
          <div className="lg:col-span-4 space-y-6">
            <Card className="border-zinc-800 bg-emerald-500/5">
              <CardHeader>
                <CardTitle className="text-sm font-medium flex items-center gap-2 text-emerald-400">
                  <Info className="h-4 w-4" />
                  Daily Sales Tips
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-zinc-400 leading-relaxed space-y-2">
                <p>
                  <span className="text-zinc-300 font-medium">Sales Report</span> — Returns detailed issuance data including tickets, EMDs, and refunds issued through the PCC.
                </p>
                <p>
                  <span className="text-zinc-300 font-medium">Sales Summary</span> — Returns the audit trail with individual transaction details, totals by settlement type, and agent activity.
                </p>
                <p className="text-zinc-500">
                  Date format: <span className="font-mono text-zinc-400">YYYY-MM-DD</span>
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
