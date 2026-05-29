export type SearchParamValue = string | string[] | undefined;

export interface DonationFilterSearchParams {
  campus?: string;
  month?: string;
  method?: SearchParamValue;
  sort?: string;
}

export const DONATION_FILTER_PAYMENT_METHOD_VALUES = ["cash", "card", "bank_transfer", "check", "other"] as const;
export const DONATION_FILTER_SORT_VALUES = ["payment_method_asc"] as const;

export function normalizeDonationMethods(value: SearchParamValue) {
  const rawValues = Array.isArray(value) ? value : value ? [value] : [];
  return rawValues.filter((method, index, allMethods): method is typeof DONATION_FILTER_PAYMENT_METHOD_VALUES[number] => (
    DONATION_FILTER_PAYMENT_METHOD_VALUES.includes(method as typeof DONATION_FILTER_PAYMENT_METHOD_VALUES[number]) &&
    allMethods.indexOf(method) === index
  ));
}

export function normalizeDonationSort(value: string | undefined) {
  return DONATION_FILTER_SORT_VALUES.includes(value as typeof DONATION_FILTER_SORT_VALUES[number]) ? value : "";
}

export function buildDonationFilterQueryString({
  campus,
  month,
  method,
  sort,
}: DonationFilterSearchParams) {
  const params = new URLSearchParams();
  if (campus) params.set("campus", campus);
  if (month) params.set("month", month);
  normalizeDonationMethods(method).forEach((currentMethod) => params.append("method", currentMethod));

  const normalizedSort = normalizeDonationSort(sort);
  if (normalizedSort) params.set("sort", normalizedSort);

  return params.toString();
}

export function buildDonationListPath(locale: string, searchParams: DonationFilterSearchParams) {
  const query = buildDonationFilterQueryString(searchParams);
  return `/${locale}/donations${query ? `?${query}` : ""}`;
}

export function safeDonationReturnPath(locale: string, rawReturnTo: unknown) {
  if (typeof rawReturnTo !== "string" || !rawReturnTo) {
    return `/${locale}/donations`;
  }

  try {
    const url = rawReturnTo.startsWith("/")
      ? new URL(rawReturnTo, "https://local.tif")
      : new URL(rawReturnTo);
    const path = `${url.pathname}${url.search}`;

    return path === `/${locale}/donations` || path.startsWith(`/${locale}/donations?`)
      ? path
      : `/${locale}/donations`;
  } catch {
    return `/${locale}/donations`;
  }
}
