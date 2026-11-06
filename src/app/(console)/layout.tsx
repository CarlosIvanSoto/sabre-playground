import { connection } from "next/server"
import { AppSidebar } from "@/components/console/app-sidebar"
import { FlowGate } from "@/components/console/flow-gate"
import { EnvironmentProvider } from "@/components/environment/environment-provider"
import { EnvironmentSwitcher } from "@/components/environment/environment-switcher"
import { HistoryProvider } from "@/components/history/history-provider"
import { CensusProvider } from "@/components/queue-census/census-provider"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { getConsoleEnvironments } from "@/server/config/environments"

/**
 * El marco de la consola: la navegación a la izquierda y, arriba, el entorno de las llamadas,
 * siempre visible. Los entornos salen del servidor sin credenciales.
 */
export default async function ConsoleLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Los entornos salen de `process.env` en cada request, no del build.
  await connection()
  return (
    <EnvironmentProvider options={getConsoleEnvironments()}>
      <HistoryProvider>
        <CensusProvider>
          <SidebarProvider>
            <AppSidebar />
            <SidebarInset>
              <header className="bg-background sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b px-4">
                <SidebarTrigger className="-ms-1" />
                <div className="ms-auto">
                  <EnvironmentSwitcher />
                </div>
              </header>
              <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
                <FlowGate>{children}</FlowGate>
              </div>
            </SidebarInset>
          </SidebarProvider>
        </CensusProvider>
      </HistoryProvider>
    </EnvironmentProvider>
  )
}
