export type SearchParamValue = string | string[] | undefined;

export interface DonationFilterSearchParams {
  campus?: string;
  month?: string;
  method?: SearchParamValue;
  sort?: string;
}

export const DONATION_FILTER_PAYMENT_METHOD_VALUES = ["cash", "card", "bank_transfer", "check", "other"] as const;
export const DONATION_FILTER_SORT_VALUES = ["gift_date_desc", "gift_date_asc", "payment_method_asc"] as const;

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

export function safeDonationReturnPath(
  locale: string,
  rawReturnTo: unknown,
  fallbackFilters: DonationFilterSearchParams = {}
) {
  const fallbackPath = buildDonationListPath(locale, fallbackFilters);
  try {
    const safeReturnTo = typeof rawReturnTo === "string" && rawReturnTo ? rawReturnTo : fallbackPath;
    const url = safeReturnTo.startsWith("/")
      ? new URL(safeReturnTo, "https://local.tif")
      : new URL(safeReturnTo);

    if (url.pathname !== `/${locale}/donations`) {
      return fallbackPath;
    }

    if (!url.searchParams.has("campus") && fallbackFilters.campus) {
      url.searchParams.set("campus", fallbackFilters.campus);
    }
    if (!url.searchParams.has("month") && fallbackFilters.month) {
      url.searchParams.set("month", fallbackFilters.month);
    }
    if (!url.searchParams.has("method")) {
      normalizeDonationMethods(fallbackFilters.method).forEach((method) => {
        url.searchParams.append("method", method);
      });
    }

    const normalizedSort = normalizeDonationSort(fallbackFilters.sort);
    if (!url.searchParams.has("sort") && normalizedSort) {
      url.searchParams.set("sort", normalizedSort);
    }

    const query = url.searchParams.toString();
    return `${url.pathname}${query ? `?${query}` : ""}`;
  } catch {
    return fallbackPath;
  }
}
