import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { CardReconciliationInstructions } from "@/components/card-reconciliation-instructions";
import {
  hasEcpaySource,
  inferEcpayClassification,
  matchesExpectedCampus,
  parseEcpaySource,
} from "@/lib/ecpay";

interface DonationRow {
  id: string;
  gift_date: string;
  amount: number;
  payment_method: string;
  deposit_reference: string | null;
  donor_id: string | null;
  notes: string | null;
  donors: { display_name: string | null } | null;
  campuses: { name: string | null } | null;
  funds: { name: string | null } | null;
}

function defaultMonth(latestGiftDate: string | null): string {
  if (latestGiftDate) return latestGiftDate.slice(0, 7);
  return new Date().toISOString().slice(0, 7);
}

function monthBounds(month: string): { start: string; end: string } {
  const [year, monthNum] = month.split("-").map(Number);
  const start = `${year}-${String(monthNum).padStart(2, "0")}-01`;
  const end =
    monthNum === 12
      ? `${year + 1}-01-01`
      : `${year}-${String(monthNum + 1).padStart(2, "0")}-01`;
  return { start, end };
}

function fmt(amount: number): string {
  return `NT$${Math.round(amount).toLocaleString()}`;
}

function firstLine(notes: string | null): string | null {
  const line = notes?.split("\n")[0]?.trim();
  return line || null;
}

function MetricCard({
  label,
  value,
  helper,
  accent,
}: {
  label: string;
  value: string;
  helper: string;
  accent: string;
}) {
  return (
    <div className={`rounded-lg border p-4 ${accent}`}>
      <p className="text-xs font-medium uppercase tracking-wide opacity-70">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
      <p className="mt-1 text-xs opacity-80">{helper}</p>
    </div>
  );
}

function SectionTable({
  locale,
  title,
  description,
  rows,
  renderStatus,
}: {
  locale: string;
  title: string;
  description: string;
  rows: DonationRow[];
  renderStatus: (row: DonationRow) => ReactNode;
}) {
  return (
    <section className="rounded-lg border bg-white overflow-hidden">
      <div className="border-b bg-gray-50 px-4 py-3">
        <h2 className="text-base font-semibold">{title}</h2>
        <p className="mt-1 text-sm text-gray-500">{description}</p>
      </div>
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wide">
          <tr>
            <th className="px-4 py-3 text-left">Date</th>
            <th className="px-4 py-3 text-left">Donor</th>
            <th className="px-4 py-3 text-left">Campus / Fund</th>
            <th className="px-4 py-3 text-right">Amount</th>
            <th className="px-4 py-3 text-left">Status</th>
            <th className="px-4 py-3 text-right">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.length === 0 && (
            <tr>
              <td colSpan={6} className="px-4 py-10 text-center text-gray-400">
                No rows in this section for the selected month.
              </td>
            </tr>
          )}
          {rows.map((row) => (
            <tr key={row.id} className="align-top hover:bg-gray-50">
              <td className="px-4 py-3 whitespace-nowrap">{row.gift_date}</td>
              <td className="px-4 py-3">
                <p className="font-medium">{row.donors?.display_name ?? "Anonymous"}</p>
                {hasEcpaySource(row.notes) ? (
                  <>
                    <p className="text-xs text-gray-500">{parseEcpaySource(row.notes).sourceDonor ?? "-"}</p>
                    <p className="text-xs text-gray-400">{parseEcpaySource(row.notes).sourceEmail ?? "-"}</p>
                  </>
                ) : (
                  firstLine(row.notes) && <p className="text-xs text-gray-400">{firstLine(row.notes)}</p>
                )}
              </td>
              <td className="px-4 py-3">
                <p>{row.campuses?.name ?? "-"}</p>
                <p className="text-xs text-gray-400">{row.funds?.name ?? "-"}</p>
              </td>
              <td className="px-4 py-3 text-right font-mono">{fmt(row.amount)}</td>
              <td className="px-4 py-3">{renderStatus(row)}</td>
              <td className="px-4 py-3 text-right">
                <Link
                  href={`/${locale}/donations/${row.id}/edit`}
                  className="text-xs text-blue-600 hover:underline"
                >
                  Edit
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

export default async function CardReconciliationPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ month?: string }>;
}) {
  const { locale } = await params;
  const { month: monthParam } = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login`);

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if ((profile as { role: string } | null)?.role !== "admin") redirect(`/${locale}`);

  const { data: latestEcpayRow } = await supabase
    .from("donations")
    .select("gift_date")
    .eq("payment_method", "card")
    .is("deleted_at", null)
    .ilike("notes", "%ECPay merchant order:%")
    .order("gift_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  const month = monthParam || defaultMonth((latestEcpayRow as { gift_date: string } | null)?.gift_date ?? null);
  const { start, end } = monthBounds(month);

  const { data } = await supabase
    .from("donations")
    .select(`
      id, gift_date, amount, payment_method, deposit_reference, donor_id, notes,
      donors ( display_name ),
      campuses ( name ),
      funds ( name )
    `)
    .eq("payment_method", "card")
    .is("deleted_at", null)
    .gte("gift_date", start)
    .lt("gift_date", end)
    .order("gift_date", { ascending: false })
    .order("amount", { ascending: false });

  const rows = (data ?? []) as unknown as DonationRow[];
  const ecpayRows = rows.filter((row) => hasEcpaySource(row.notes));
  const extraCardRows = rows.filter((row) => !hasEcpaySource(row.notes));
  const unresolvedDonorRows = ecpayRows.filter((row) => !row.donor_id);
  const classificationMismatchRows = ecpayRows.filter((row) => {
    const source = parseEcpaySource(row.notes);
    const expected = inferEcpayClassification(source.sourceTradeDesc);
    if (!expected) return false;
    const campusOk = matchesExpectedCampus(row.campuses?.name ?? null, expected.campus);
    const fundOk = (row.funds?.name ?? "").trim() === expected.fund;
    return !campusOk || !fundOk;
  });

  const ecpayTotal = ecpayRows.reduce((sum, row) => sum + row.amount, 0);
  const extraTotal = extraCardRows.reduce((sum, row) => sum + row.amount, 0);
  const allCardTotal = rows.reduce((sum, row) => sum + row.amount, 0);
  const openIssueCount = new Set(
    [...unresolvedDonorRows, ...classificationMismatchRows].map((row) => row.id)
  ).size;

  return (
    <CardReconciliationInstructions month={month}>
      <div className="space-y-8 max-w-7xl">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Card Reconciliation</h1>
          <p className="mt-1 text-sm text-gray-500">
            Compare imported ECPay card activity with donation records, then resolve donor,
            classification, and extra-row issues for a selected month.
          </p>
        </div>
        <form className="flex items-center gap-2">
          <input
            type="month"
            name="month"
            defaultValue={month}
            className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            View
          </button>
        </form>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard
          label="All Card Donations"
          value={fmt(allCardTotal)}
          helper={`${rows.length} rows in ${month}`}
          accent="bg-slate-50 text-slate-900 border-slate-200"
        />
        <MetricCard
          label="ECPay Imported"
          value={fmt(ecpayTotal)}
          helper={`${ecpayRows.length} rows tied to ECPay source`}
          accent="bg-emerald-50 text-emerald-900 border-emerald-200"
        />
        <MetricCard
          label="Extra Card Rows"
          value={fmt(extraTotal)}
          helper={`${extraCardRows.length} rows not tied to ECPay export`}
          accent="bg-amber-50 text-amber-900 border-amber-200"
        />
        <MetricCard
          label="Open Issues"
          value={String(openIssueCount)}
          helper={`${unresolvedDonorRows.length} donor, ${classificationMismatchRows.length} classification`}
          accent="bg-rose-50 text-rose-900 border-rose-200"
        />
      </div>

      {(extraCardRows.length > 0 || unresolvedDonorRows.length > 0 || classificationMismatchRows.length > 0) && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-medium">This month still needs reconciliation work.</p>
          <p className="mt-1">
            Focus first on donor review, then classification mismatches, then any extra card rows
            that are not linked to the ECPay export.
          </p>
        </div>
      )}

      <SectionTable
        locale={locale}
        title="Donor Review"
        description="ECPay-imported card rows that still have no donor linked."
        rows={unresolvedDonorRows}
        renderStatus={(row) => {
          const source = parseEcpaySource(row.notes);
          return (
            <div className="space-y-1">
              <Badge variant="outline" className="border-amber-300 bg-amber-100 text-amber-800">
                Needs donor link
              </Badge>
              <p className="text-xs text-gray-500">{source.suggestedReason ?? "manual review"}</p>
            </div>
          );
        }}
      />

      <SectionTable
        locale={locale}
        title="Classification Mismatch"
        description="Rows where the ECPay trade description suggests a different campus or fund than the current donation record."
        rows={classificationMismatchRows}
        renderStatus={(row) => {
          const source = parseEcpaySource(row.notes);
          const expected = inferEcpayClassification(source.sourceTradeDesc);
          return (
            <div className="space-y-1">
              <Badge variant="outline" className="border-rose-300 bg-rose-100 text-rose-800">
                Review campus/fund
              </Badge>
              <p className="text-xs text-gray-500">
                Expected: {expected?.campus ?? "?"} / {expected?.fund ?? "?"}
              </p>
              <p className="text-xs text-gray-400">{source.sourceTradeDesc ?? "-"}</p>
            </div>
          );
        }}
      />

      <SectionTable
        locale={locale}
        title="Extra Card Donations"
        description="Card donations in the month that are not tied to an imported ECPay source row."
        rows={extraCardRows}
        renderStatus={() => (
          <div className="space-y-1">
            <Badge variant="outline" className="border-slate-300 bg-slate-100 text-slate-800">
              Not linked to ECPay
            </Badge>
            <p className="text-xs text-gray-500">Check whether this is valid non-ECPay card data or a duplicate.</p>
          </div>
        )}
      />

      <SectionTable
        locale={locale}
        title="Imported ECPay Rows"
        description="All card donations in the selected month that are already linked to the ECPay export."
        rows={ecpayRows}
        renderStatus={(row) => {
          const source = parseEcpaySource(row.notes);
          return (
            <div className="space-y-1">
              <Badge variant="outline" className="border-emerald-300 bg-emerald-100 text-emerald-800">
                ECPay linked
              </Badge>
              <p className="text-xs text-gray-500">{source.merchantOrder ?? "-"}</p>
            </div>
          );
        }}
      />
      </div>
    </CardReconciliationInstructions>
  );
}
