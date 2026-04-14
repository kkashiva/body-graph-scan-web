export default async function ScanDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div>
      <h1 className="text-2xl font-bold">Scan Results</h1>
      <p className="mt-2 text-gray-500">
        Results for scan {id} will appear here.
      </p>
    </div>
  );
}
