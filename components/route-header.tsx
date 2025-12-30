import { Edit, RotateCcw, ArrowRight } from 'lucide-react'

interface RouteHeaderProps {
  origin: string
  destination: string
  onEdit: () => void
  onReset: () => void
  className?: string
}

export default function RouteHeader({
  origin,
  destination,
  onEdit,
  onReset,
  className = '',
}: RouteHeaderProps) {
  const formatLocation = (location: string) => {
    const parts = location.split(',')
    return parts[0].trim()
  }

  return (
    <div className={`card-transit p-0 mb-6 ${className}`}>
      {/* Status Bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border/50 bg-muted/10">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 bg-primary rounded-full animate-pulse-dot"></span>
          <span className="font-mono text-xs tracking-widest uppercase text-primary">
            Live Route
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={onEdit}
            className="flex items-center font-mono text-xs font-bold uppercase tracking-wider text-secondary hover:text-secondary/80 transition-colors"
          >
            <Edit className="h-3 w-3 mr-1" />
            Edit
          </button>
          <button
            onClick={onReset}
            className="flex items-center font-mono text-xs font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
          >
            <RotateCcw className="h-3 w-3 mr-1" />
            New
          </button>
        </div>
      </div>

      {/* Route Display */}
      <div className="p-4 flex items-center justify-center gap-3">
        <div className="w-3 h-3 rounded-sm bg-secondary flex-shrink-0" />
        <h2 className="text-xl sm:text-2xl font-display font-normal text-foreground truncate uppercase tracking-tight">
          {formatLocation(origin)}
        </h2>
        <ArrowRight className="w-5 h-5 text-muted-foreground flex-shrink-0" />
        <h2 className="text-xl sm:text-2xl font-display font-normal text-foreground truncate uppercase tracking-tight">
          {formatLocation(destination)}
        </h2>
        <div className="w-3 h-3 rounded-sm bg-primary flex-shrink-0" />
      </div>
    </div>
  )
}
