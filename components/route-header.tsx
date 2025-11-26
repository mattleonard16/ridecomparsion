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
    <div className={`card-elevated rounded-xl p-4 mb-6 ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0 flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-secondary flex-shrink-0" />
          <h2 className="text-lg font-bold text-foreground truncate">
            {formatLocation(origin)}
          </h2>
          <ArrowRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <h2 className="text-lg font-bold text-foreground truncate">
            {formatLocation(destination)}
          </h2>
          <div className="w-3 h-3 rounded-full bg-primary flex-shrink-0" />
        </div>
        <div className="flex items-center space-x-3 ml-4">
          <button
            onClick={onEdit}
            className="flex items-center text-sm text-secondary hover:text-secondary/80 transition-colors"
          >
            <Edit className="h-4 w-4 mr-1" />
            Edit
          </button>
          <button
            onClick={onReset}
            className="flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <RotateCcw className="h-4 w-4 mr-1" />
            New
          </button>
        </div>
      </div>
    </div>
  )
}
