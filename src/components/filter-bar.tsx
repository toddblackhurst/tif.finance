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
  paymentMethodMode?: "single" | "multi";
  allPaymentMethodsLabel?: string;
  paymentMethodLabel?: string;
  paymentMethods?: { value: string; label: string }[];
  sortLabel?: string;
  sortOptions?: { value: string; label: string }[];
}

export function FilterBar({
  campuses,
  showStatus = false,
  paymentMethodMode,
  allPaymentMethodsLabel = "All Payment Methods",
  paymentMethodLabel = "Payment Method",
  paymentMethods = [],
  sortLabel = "Sort",
  sortOptions = [],
}: FilterBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  function pushParams(params: URLSearchParams) {
    params.delete("page");
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  function set(key: string, val: string) {
    const params = new URLSearchParams(sp.toString());
    if (val) params.set(key, val);
    else params.delete(key);
    pushParams(params);
  }

  function toggleMultiValue(key: string, val: string) {
    const params = new URLSearchParams(sp.toString());
    const nextValues = params.getAll(key).includes(val)
      ? params.getAll(key).filter((current) => current !== val)
      : [...params.getAll(key), val];
    params.delete(key);
    nextValues.forEach((nextValue) => params.append(key, nextValue));
    pushParams(params);
  }

  const campus = sp.get("campus") ?? "";
  const month = sp.get("month") ?? "";
  const status = sp.get("status") ?? "";
  const selectedMethods = paymentMethodMode === "multi"
    ? sp.getAll("method")
    : [sp.get("method") ?? ""].filter(Boolean);
  const sort = sp.get("sort") ?? "";
  const hasFilter = !!(campus || month || status || selectedMethods.length || sort);

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

      {paymentMethodMode === "single" && paymentMethods.length > 0 && (
        <select
          value={selectedMethods[0] ?? ""}
          onChange={(e) => set("method", e.target.value)}
          className={SELECT_CLS}
        >
          <option value="">{allPaymentMethodsLabel}</option>
          {paymentMethods.map((method) => (
            <option key={method.value} value={method.value}>{method.label}</option>
          ))}
        </select>
      )}

      {paymentMethodMode === "multi" && paymentMethods.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-gray-500">{paymentMethodLabel}</span>
          {paymentMethods.map((method) => {
            const active = selectedMethods.includes(method.value);
            return (
              <button
                key={method.value}
                type="button"
                onClick={() => toggleMultiValue("method", method.value)}
                className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                  active
                    ? "border-blue-600 bg-blue-50 text-blue-700"
                    : "border-gray-300 bg-white text-gray-700 hover:border-gray-400"
                }`}
              >
                {method.label}
              </button>
            );
          })}
        </div>
      )}

      {sortOptions.length > 0 && (
        <select value={sort} onChange={(e) => set("sort", e.target.value)} className={SELECT_CLS}>
          <option value="">{sortLabel}</option>
          {sortOptions.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
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
