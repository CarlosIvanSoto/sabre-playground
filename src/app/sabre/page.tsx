import React from "react"
import Link from "next/link"
import { CredentialsForm } from "@/components/features/sabre/credentials-form"
import { SessionStatus } from "@/components/features/sabre/session-status"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Layers,
  CalendarRange,
  FileBarChart2,
  Plane,
  Armchair,
  MessageSquarePlus,
  ArrowRightLeft,
  LogOut,
  Search,
  Users,
  LockOpen,
  X,
  CircleX,
  Bookmark,
  BookX,
  BookPlus,
  NotebookPen,
  BookSearch,
  Ticket,
  TicketX,
  TicketMinus,
  TicketCheck,
  ArrowRightToLine
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { sabre_credentials } from "@/config/env"
import { cookies } from "next/headers"
import { Separator } from "@/components/ui/separator"

function FeatureCard({
  title,
  description,
  icon: Icon,
  children,
  href
}: {
  title: string;
  description: string;
  icon: React.ElementType;
  children?: React.ReactNode;
  href?: string;
}) {
  return (
    <Card className="group relative overflow-hidden border-zinc-800 bg-zinc-950/50 hover:bg-zinc-900/80 transition-all duration-300 hover:shadow-xl hover:shadow-primary/5 hover:-translate-y-1">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      <CardHeader>
        {href ? (
          <Link prefetch={false} href={href} className="z-10">
            <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-900 ring-1 ring-zinc-800 group-hover:bg-primary/20 group-hover:ring-primary/50 transition-colors">
              <Icon className="h-5 w-5 text-zinc-400 group-hover:text-primary transition-colors" />
            </div>
          </Link>
        ) : (
          <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-900 ring-1 ring-zinc-800 group-hover:bg-primary/20 group-hover:ring-primary/50 transition-colors">
            <Icon className="h-5 w-5 text-zinc-400 group-hover:text-primary transition-colors" />
          </div>
        )}
        <CardTitle className="text-xl font-medium text-zinc-100">{title}</CardTitle>
        <CardDescription className="text-zinc-400">{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {children}
      </CardContent>
    </Card>
  )
}

function ActionRow({ label, icon: Icon }: { label: string; icon: any }) {
  return (
    <Button variant="ghost" className="w-full justify-start text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50 h-9">
      <Icon className="mr-2 h-4 w-4" />
      {label}
    </Button>
  )
}

export default async function SabrePage() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("sessionToken")?.value;
  // Parseamos la info que nosotros mismos guardamos
  const { token, expiresAt } = JSON.parse(sessionToken || "{}");
  return (
    <div className="min-h-screen bg-black text-white selection:bg-primary/20">
      {/* Ambient Background */}
      <div className="fixed inset-0 z-0">
        <div className="absolute -top-[20%] -left-[10%] h-[700px] w-[700px] rounded-full bg-blue-900/10 blur-[100px]" />
        <div className="absolute -bottom-[20%] -right-[10%] h-[700px] w-[700px] rounded-full bg-indigo-900/10 blur-[100px]" />
      </div>

      <div className="relative z-10 container mx-auto px-4 py-12 max-w-7xl">
        {/* Header */}
        <div className="mb-16 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
          <div className="space-y-4 max-w-2xl text-center md:text-left">
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight bg-gradient-to-r from-white via-zinc-200 to-zinc-500 bg-clip-text text-transparent">
              Sabre SDK Center
            </h1>
            <p className="text-lg text-zinc-400">
              Authorize your session and access extensive Sabre Global Distribution System capabilities.
              Manage queues, bookings, and financial reports from a unified interface.
            </p>
            {/* <pre className="text-xs text-zinc-400">{JSON.stringify({ token, expiresAt }, null, 2)}</pre> */}
          </div>
          {sessionToken ? (
            <div className="md:self-center">
              <SessionStatus token={token} expiresAt={expiresAt} />
            </div>
          ) : (
            <Dialog>
              <DialogTrigger asChild>
                <Button size="lg" className="rounded-full bg-white text-black hover:bg-zinc-200 transition-all duration-300 shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_30px_rgba(255,255,255,0.2)] md:self-center">
                  <LockOpen className="mr-2 h-5 w-5" />
                  Start New Session
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md bg-zinc-950 border-zinc-800 text-zinc-100">
                <DialogHeader>
                  <DialogTitle className="text-xl">Sabre Session Credentials</DialogTitle>
                  <DialogDescription className="text-zinc-400">
                    Enter your PCC details to authorize the session for API consumption.
                  </DialogDescription>
                </DialogHeader>
                <CredentialsForm initialData={sabre_credentials} />
              </DialogContent>
            </Dialog>
          )}
        </div>

        {/* Features Grid */}
        < div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6" >

          {/* Queue Management */}
          < FeatureCard
            href="/sabre/queue"
            title="Queue Management"
            description="Comprehensive queue operations and PNR control."
            icon={Layers}
          >
            <div className="space-y-1">
              <ActionRow label="Queue Count" icon={Layers} />
              <ActionRow label="Get PNR List" icon={Users} />
              <ActionRow label="Access Queue" icon={ArrowRightLeft} />
              <ActionRow label="Ignore PNR & Exit" icon={LogOut} />
              <ActionRow label="Ignore PNR & Next" icon={ArrowRightToLine} />
              <ActionRow label="Remove PNR & Next" icon={CircleX} />
              <ActionRow label="Place PNR & Next" icon={Bookmark} />
            </div>
          </FeatureCard >

          {/* Booking & PNR */}
          < FeatureCard
            title="Booking Management"
            description="Manage sessions and passenger records effectively."
            icon={Armchair}
          >
            <div className="space-y-1">
              <ActionRow label="Get booking" icon={BookSearch} />
              <ActionRow label="Create booking" icon={BookPlus} />
              <ActionRow label="Cancel Booking" icon={BookX} />
              <ActionRow label="Modify Booking" icon={NotebookPen} />
              <Separator />
              <ActionRow label="Fulfill Flight Tickets" icon={Ticket} />
              <ActionRow label="Check Flight Tickets" icon={TicketCheck} />
              <ActionRow label="Void Flight Tickets" icon={TicketMinus} />
              <ActionRow label="Refund Flight Tickets" icon={TicketX} />
            </div>
          </FeatureCard >

          {/* Reporting */}
          < FeatureCard
            href="/sabre/daily-sales"
            title="Reporting"
            description="Sales data, daily summaries and audit trails."
            icon={FileBarChart2}
          >
            <div className="space-y-1">
              <ActionRow label="Daily Sales Report" icon={CalendarRange} />
              <ActionRow label="Audit Trail Summary" icon={FileBarChart2} />
            </div>
          </FeatureCard >

        </div >
      </div >
    </div >
  )
}
