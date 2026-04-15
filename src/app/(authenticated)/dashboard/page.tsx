export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Your Scans
        </h1>
      </div>
      <p className="text-sm leading-relaxed text-muted-foreground">
        Your body scan history and trendlines will appear here.
      </p>
    </div>
  );
}
