import { AdvancedSearch } from "@/components/features/search/advanced-search-form";
import { CorporateQuickSearch } from "@/components/features/search/corporate-quick-search";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-4 py-8">
        <Tabs defaultValue="advanced" className="w-full">
          <TabsList className="grid w-full max-w-md mx-auto grid-cols-2 mb-4">
            <TabsTrigger value="advanced" className="text-sm">
              Búsqueda Avanzada
            </TabsTrigger>
            <TabsTrigger value="corporate" className="text-sm">
              Acceso Corporativo
            </TabsTrigger>
          </TabsList>

          <TabsContent value="advanced" className="mt-0">
            <AdvancedSearch />
          </TabsContent>

          <TabsContent value="corporate" className="mt-0">
            <CorporateQuickSearch />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
