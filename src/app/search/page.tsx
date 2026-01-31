import { GroupedItinerary } from "@/components/features/search/grouped-itinerary";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { searchFlights, searchOptionsSchema } from "@/services/air/search";

interface SabreSearchPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function SearchResultsPage({
  searchParams,
}: SabreSearchPageProps) {
  const { itinerary, travelers } = (await searchParams);
  if (typeof itinerary !== 'string' || typeof travelers !== 'string') {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-destructive">Parámetros de búsqueda inválidos</h1>
        <p className="mt-4 text-destructive">Los parámetros &apos;itinerary&apos;: ${typeof itinerary} y &apos;travelers&apos;: ${typeof travelers} son obligatorios y deben ser cadenas.</p>
      </div>
    )
  }
  const [adults, children, infants] = travelers.split('_')
  const searchOptions = {
    itinerary: itinerary.split('.').map((leg) => {
      const [origin, destination, departureDate] = leg.split('_')
      return { origin, destination, departureDate: new Date(departureDate) }
    }),
    travelers: {
      adults: Number(adults.slice(1)),
      children: Number(children.slice(1)),
      infants: Number(infants.slice(1)),
    }
  }
  const validatedParams = searchOptionsSchema.safeParse(searchOptions)

  if (!validatedParams.success) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-destructive">Parámetros de búsqueda inválidos</h1>
        <pre className="mt-4 bg-muted p-4 rounded-md text-destructive">
          {JSON.stringify(validatedParams.error.issues, null, 2)}
        </pre>
      </div>
    )
  }

  const result = await searchFlights(validatedParams.data)
  if (!result.data){
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">Error de validación</CardTitle>
            <CardDescription>Los parámetros de búsqueda no son válidos</CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="mt-2 w-full overflow-auto rounded-md bg-muted p-4 text-sm">
              <code>{JSON.stringify(result, null, 2)}</code>
            </pre>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <GroupedItinerary data={result.data} />
      <Card>
        <CardHeader>
          <CardTitle>Resultados de la Búsqueda</CardTitle>
          <CardDescription>Respuesta de la API de Sabre.</CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="mt-2 w-full overflow-auto rounded-md bg-slate-950 p-4">
            <code className="text-white">
              {JSON.stringify(result, null, 2)}
            </code>
          </pre>
        </CardContent>
      </Card>
    </div>
  )
}