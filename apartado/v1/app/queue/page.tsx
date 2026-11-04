import Link from "next/link"
import {
  ArrowLeft,
  Layers,
  Users,
  ArrowRightLeft,
  Hash,
  ChevronRight,
  History,
  Info
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import { cookies } from "next/headers"
import { SessionStatus } from "@/components/features/sabre/session-status"
import { QueueCountForm } from "@/components/features/sabre/queue-count-form"
import { QueueAccessListForm } from "@/components/features/sabre/queue-access-list-form";
import { QueueAccessForm } from "@/components/features/sabre/queue-access-form";

function QueueActionCard({
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

export default async function QueueManagementPage() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("sessionToken")?.value;
  // Parseamos la info que nosotros mismos guardamos
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
                Queue Management
              </h1>
              <p className="text-lg text-zinc-400 max-w-2xl">
                Monitor and process Sabre queues. Count entries, list PNRs, and manage queue workflow.
              </p>
            </div>
            <div className="md:self-center">
              <SessionStatus token={token} expiresAt={expiresAt} />
            </div>
            {/* <div className="flex items-center gap-3 bg-zinc-900/50 px-4 py-2 rounded-full border border-zinc-800">
              <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-sm font-medium text-zinc-300">Connected to Sabre</span>
            </div> */}
          </div>
        </div>

        {/* Main Interface */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

          {/* Left: Quick Actions Forms */}
          <div className="lg:col-span-8 space-y-6">
            <Tabs defaultValue="count" className="w-full">
              <TabsList className="bg-zinc-900 border border-zinc-800 mb-6">
                <TabsTrigger value="count" className="data-[state=active]:bg-zinc-800">Queue Count</TabsTrigger>
                <TabsTrigger value="list" className="data-[state=active]:bg-zinc-800">PNR List</TabsTrigger>
                <TabsTrigger value="access" className="data-[state=active]:bg-zinc-800">Access Queue</TabsTrigger>
              </TabsList>

              <TabsContent value="count">
                <QueueActionCard
                  title="Queue Count"
                  description="Check the number of messages and PNRs in specific queues."
                  icon={Layers}
                >
                  <QueueCountForm />
                </QueueActionCard>
              </TabsContent>

              <TabsContent value="list">
                <QueueActionCard
                  title="Get PNR List"
                  description="Retrieve a list of all PNRs currently waiting in a queue."
                  icon={Users}
                >
                  <QueueAccessListForm />
                </QueueActionCard>
              </TabsContent>

              <TabsContent value="access">
                <QueueActionCard
                  title="Access Queue"
                  description="Enter a queue to begin processing PNRs sequentially."
                  icon={ArrowRightLeft}
                >
                  <QueueAccessForm />
                </QueueActionCard>
              </TabsContent>
            </Tabs>
          </div>

          {/* Right: Info & Status */}
          <div className="lg:col-span-4 space-y-6">
            <Card className="border-zinc-800 bg-zinc-900/40 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <History className="h-4 w-4 text-zinc-400" />
                  Recent Activity
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-start gap-3 text-xs">
                      <div className="mt-1 h-1.5 w-1.5 rounded-full bg-zinc-700" />
                      <div className="space-y-1">
                        <p className="text-zinc-300">Checked Queue Count for Q50</p>
                        <p className="text-zinc-500">2 minutes ago</p>
                      </div>
                    </div>
                  ))}
                  <Button variant="link" className="text-xs text-zinc-500 p-0 h-auto hover:text-white">
                    View all history
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="border-zinc-800 bg-emerald-500/5">
              <CardHeader>
                <CardTitle className="text-sm font-medium flex items-center gap-2 text-emerald-400">
                  <Info className="h-4 w-4" />
                  Queue Tips
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-zinc-400 leading-relaxed">
                Always ensure you have cleared your workspace (Ignore PNR & Exit) before accessing a new queue to prevent PNR conflicts.
              </CardContent>
            </Card>
          </div>
        </div>

      </div>
    </div>
  )
}
