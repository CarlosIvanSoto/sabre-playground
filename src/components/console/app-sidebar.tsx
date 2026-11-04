"use client"

import { FlaskConicalIcon, HistoryIcon, TerminalIcon } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
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
import { FLOWS } from "@/lib/flows"

/** La navegación de la consola: los siete flujos, el historial y las páginas de desarrollo. */
export function AppSidebar() {
  const pathname = usePathname()
  const { entries } = useHistory()

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
              {FLOWS.map((flow) => (
                <SidebarMenuItem key={flow.slug}>
                  <SidebarMenuButton
                    tooltip={flow.title}
                    isActive={pathname === `/${flow.slug}`}
                    render={<Link href={`/${flow.slug}`} />}
                  >
                    <span className="text-muted-foreground w-4 shrink-0 text-center font-mono text-xs">
                      {flow.number}
                    </span>
                    <span>{flow.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
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
