/** Placeholder for panel pages that are built in later steps. */
export function ComingSoon({ what }: { what: string }) {
  return (
    <div className="panel p-8 text-center">
      <div className="text-4xl">🚧</div>
      <h2 className="mt-3 text-xl">Coming in the next step</h2>
      <p className="mt-1 text-sm text-muted">{what} will appear here.</p>
    </div>
  );
}
