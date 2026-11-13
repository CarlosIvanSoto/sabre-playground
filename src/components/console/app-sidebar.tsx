"use client"

import {
  FlaskConicalIcon,
  HistoryIcon,
  InboxIcon,
  ScanSearchIcon,
  TerminalIcon,
} from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEnvironment } from "@/components/environment/environment-provider"
import { useHistory } from "@/components/history/history-provider"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar"
import { FLOWS, flowUnavailable } from "@/lib/flows"

/**
 * La navegación de la consola: los flujos, el historial y las páginas de desarrollo. Un
 * flujo que no corre en el entorno elegido se ve atenuado, con la razón en el tooltip; su
 * página explica por qué.
 */
export function AppSidebar() {
  const pathname = usePathname()
  const { entries } = useHistory()
  const { environment } = useEnvironment()

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              tooltip="sabre-playground"
              render={<Link href="/" />}
            >
              <div className="bg-primary text-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
                <TerminalIcon className="size-4" />
              </div>
              <div className="grid flex-1 text-start text-sm leading-tight">
                <span className="truncate font-medium">sabre-playground</span>
                <span className="text-muted-foreground truncate text-xs">
                  consola de sabre-client
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Flujos</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {FLOWS.map((flow) => {
                const unavailable = flowUnavailable(flow, environment)
                return (
                  <SidebarMenuItem key={flow.slug}>
                    <SidebarMenuButton
                      tooltip={
                        unavailable === undefined
                          ? flow.title
                          : `${flow.title}: ${unavailable}`
                      }
                      isActive={pathname.split("/")[1] === flow.slug}
                      className={
                        unavailable === undefined ? undefined : "opacity-50"
                      }
                      render={<Link href={`/${flow.slug}`} />}
                    >
                      <span className="text-muted-foreground w-4 shrink-0 text-center font-mono text-xs">
                        {flow.number}
                      </span>
                      <span>{flow.title}</span>
                      {unavailable !== undefined && (
                        <span className="sr-only">
                          (no corre en {environment.label})
                        </span>
                      )}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Mesas</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  tooltip="Mesa de colas"
                  isActive={pathname.startsWith("/queue-desk")}
                  render={<Link href="/queue-desk" />}
                >
                  <InboxIcon />
                  <span>Mesa de colas</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  tooltip="Censo de colas"
                  isActive={pathname.startsWith("/queue-census")}
                  render={<Link href="/queue-census" />}
                >
                  <ScanSearchIcon />
                  <span>Censo de colas</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Sesión</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  tooltip="Historial"
                  isActive={pathname === "/history"}
                  render={<Link href="/history" />}
                >
                  <HistoryIcon />
                  <span>Historial</span>
                </SidebarMenuButton>
                {entries.length > 0 && (
                  <SidebarMenuBadge>{entries.length}</SidebarMenuBadge>
                )}
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Desarrollo</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  tooltip="Prueba de runStep"
                  isActive={pathname === "/dev/run-step"}
                  render={<Link href="/dev/run-step" />}
                >
                  <FlaskConicalIcon />
                  <span>Prueba de runStep</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  )
}
