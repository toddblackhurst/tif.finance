export interface EcpaySourceInfo {
  sourceDonor: string | null;
  sourcePhone: string | null;
  sourceEmail: string | null;
  sourceTransaction: string | null;
  sourceTradeDesc: string | null;
  merchantOrder: string | null;
  authNumber: string | null;
  issuingBank: string | null;
  responseCode: string | null;
  suggestedMatch: string | null;
  suggestedReason: string | null;
}

export interface EcpayExpectedClassification {
  campus: string;
  fund: string;
}

function lineValue(notes: string | null, label: string): string | null {
  const line = notes?.split("\n").find((entry) => entry.startsWith(`${label}:`));
  const value = line?.slice(label.length + 1).trim();
  return value && value !== "(blank)" && value !== "(manual review)" ? value : null;
}

export function hasEcpaySource(notes: string | null): boolean {
  return (notes ?? "").includes("ECPay merchant order:");
}

export function parseEcpaySource(notes: string | null): EcpaySourceInfo {
  return {
    sourceDonor: lineValue(notes, "Source donor"),
    sourcePhone: lineValue(notes, "Source phone"),
    sourceEmail: lineValue(notes, "Source email"),
    sourceTransaction: lineValue(notes, "Source transaction"),
    sourceTradeDesc: lineValue(notes, "Source tradedesc"),
    merchantOrder: lineValue(notes, "ECPay merchant order"),
    authNumber: lineValue(notes, "ECPay auth number"),
    issuingBank: lineValue(notes, "ECPay issuing bank"),
    responseCode: lineValue(notes, "ECPay response code"),
    suggestedMatch: lineValue(notes, "Suggested match"),
    suggestedReason: lineValue(notes, "Suggested reason"),
  };
}

export function inferEcpayClassification(tradeDesc: string | null): EcpayExpectedClassification | null {
  const text = (tradeDesc ?? "").replace(/\s+/g, " ").trim().toLowerCase();
  if (!text) return null;
  if (text.includes("vbs") && text.includes("hope")) {
    return { campus: "Hope Fellowship", fund: "VBS" };
  }
  if (text.includes("hope fellowship") || (tradeDesc ?? "").includes("盼望教會")) {
    return { campus: "Hope Fellowship", fund: "General" };
  }
  if (text.includes("all praise")) {
    return { campus: "All Praise", fund: "General" };
  }
  if (text.includes("tif south")) {
    return { campus: "TIF South", fund: "General" };
  }
  if (text.includes("tif north")) {
    return { campus: "TIF North", fund: "General" };
  }
  if (text.includes("tif regular offering")) {
    return { campus: "TIF System", fund: "General" };
  }
  return null;
}

function normalizeCampus(value: string | null): string {
  const text = (value ?? "").toLowerCase();
  if (text.includes("hope fellowship")) return "hope fellowship";
  if (text.includes("all praise")) return "all praise";
  if (text.includes("tif south")) return "tif south";
  if (text.includes("tif north")) return "tif north";
  if (text.includes("tif system")) return "tif system";
  return text.trim();
}

export function matchesExpectedCampus(actual: string | null, expected: string): boolean {
  return normalizeCampus(actual) === normalizeCampus(expected);
}
