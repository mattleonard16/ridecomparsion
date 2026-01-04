import dynamic from 'next/dynamic'

type RouteMapProps = {
  pickup: [number, number] | null
  destination: [number, number] | null
}

// Dynamic import to avoid SSR - MapLibre GL requires browser APIs
const DynamicMap = dynamic(() => import('./RouteMapClient'), {
  ssr: false,
  loading: () => (
    <div className="mt-4 h-[300px] w-full bg-muted rounded-lg flex items-center justify-center">
      <div className="text-center">
        <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
        <div className="text-muted-foreground font-medium">Loading map...</div>
      </div>
    </div>
  ),
}) as React.ComponentType<RouteMapProps>

export default function RouteMap({ pickup, destination }: RouteMapProps) {
  // Show placeholder if coordinates are not available
  if (!pickup || !destination) {
    return (
      <div className="mt-4 h-[300px] w-full rounded-lg border-2 border-dashed border-muted-foreground/25 bg-muted/50 flex items-center justify-center">
        <div className="text-center text-muted-foreground">
          <div className="text-lg mb-2">Map</div>
          <div className="font-medium">Map will appear here</div>
          <div className="text-sm">Enter pickup and destination locations</div>
        </div>
      </div>
    )
  }

  return <DynamicMap pickup={pickup} destination={destination} />
}
