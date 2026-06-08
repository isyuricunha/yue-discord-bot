import { SkeletonDashboard } from '../ui/skeleton_presets'

export function RouteLoading({ fullScreen = false }: { fullScreen?: boolean }) {
  const content = (
    <div className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-5" aria-hidden="true">
      <SkeletonDashboard />
    </div>
  )

  if (!fullScreen) return content

  return (
    <div data-theme="yudark" className="min-h-screen bg-canvas text-foreground">
      {content}
    </div>
  )
}
