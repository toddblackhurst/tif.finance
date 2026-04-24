import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { BankUploadForm } from "@/components/bank-upload-form";

interface BatchSummary {
  import_batch_id: string;
  imported_at: string;
  total: number;
  unmatched: number;
  matched: number;
  ignored: number;
}

export default async function BankPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const supabase = await createClient();

  // Aggregate batches
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rawLines } = await (supabase as any)
    .from("bank_import_lines")
    .select("import_batch_id, imported_at, match_status")
    .order("imported_at", { ascending: false });

  const lines = (rawLines ?? []) as {
    import_batch_id: string;
    imported_at: string;
    match_status: string;
  }[];

  const batches: Record<string, BatchSummary> = {};
  for (const line of lines) {
    if (!batches[line.import_batch_id]) {
      batches[line.import_batch_id] = {
        import_batch_id: line.import_batch_id,
        imported_at: line.imported_at,
        total: 0,
        unmatched: 0,
        matched: 0,
        ignored: 0,
      };
    }
    batches[line.import_batch_id].total++;
    if (line.match_status === "matched")   batches[line.import_batch_id].matched++;
    if (line.match_status === "unmatched") batches[line.import_batch_id].unmatched++;
    if (line.match_status === "ignored")   batches[line.import_batch_id].ignored++;
  }

  const batchList = Object.values(batches).sort(
    (a, b) => new Date(b.imported_at).getTime() - new Date(a.imported_at).getTime()
  );

  return (
    <div className="space-y-8 max-w-4xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Bank Reconciliation</h1>
      </div>

      {/* Upload form */}
      <section className="bg-white rounded-lg border p-6">
        <h2 className="text-base font-semibold mb-4">Upload Bank CSV</h2>
        <p className="text-sm text-gray-500 mb-4">
          Export a CSV from your bank and upload it here. Map the column names below.
          Rows will be staged for matching against donation records.
        </p>
        <BankUploadForm locale={locale} />
      </section>

      {/* Existing batches */}
      {batchList.length > 0 && (
        <section>
          <h2 className="text-base font-semibold mb-3">Import History</h2>
          <div className="rounded-lg border bg-white overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-3 text-left">Imported</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3 text-right">Matched</th>
                  <th className="px-4 py-3 text-right">Ignored</th>
                  <th className="px-4 py-3 text-right">Unmatched</th>
                  <th className="px-4 py-3 text-right">Status</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {batchList.map((b) => (
                  <tr key={b.import_batch_id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      {new Date(b.imported_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">{b.total}</td>
                    <td className="px-4 py-3 text-right text-green-700">{b.matched}</td>
                    <td className="px-4 py-3 text-right text-gray-500">{b.ignored}</td>
                    <td className="px-4 py-3 text-right text-amber-700 font-medium">{b.unmatched}</td>
                    <td className="px-4 py-3 text-right">
                      {b.unmatched === 0 ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">
                          Closed
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700">
                          Pending
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/${locale}/bank/${b.import_batch_id}`}
                        className="text-blue-600 hover:underline text-xs"
                      >
                        Review →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
