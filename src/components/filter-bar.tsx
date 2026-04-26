"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";

const STATUSES = [
  { value: "", label: "All statuses" },
  { value: "draft", label: "Draft" },
  { value: "submitted", label: "Submitted" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "paid", label: "Paid" },
];

const SELECT_CLS =
  "rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500";

interface FilterBarProps {
  campuses: { id: string; name: string }[];
  showStatus?: boolean;
}

export function FilterBar({ campuses, showStatus = false }: FilterBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  function set(key: string, val: string) {
    const params = new URLSearchParams(sp.toString());
    if (val) params.set(key, val);
    else params.delete(key);
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  const campus = sp.get("campus") ?? "";
  const month = sp.get("month") ?? "";
  const status = sp.get("status") ?? "";
  const hasFilter = !!(campus || month || status);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select value={campus} onChange={(e) => set("campus", e.target.value)} className={SELECT_CLS}>
        <option value="">All campuses</option>
        {campuses.map((c) => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>

      <input
        type="month"
        value={month}
        onChange={(e) => set("month", e.target.value)}
        className={SELECT_CLS}
      />

      {showStatus && (
        <select value={status} onChange={(e) => set("status", e.target.value)} className={SELECT_CLS}>
          {STATUSES.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
      )}

      {hasFilter && (
        <button
          onClick={() => router.push(pathname)}
          className="text-sm text-gray-500 hover:text-gray-700 px-2"
        >
          × Clear
        </button>
      )}
    </div>
  );
}
