import { inferEcpayClassification } from "@/lib/ecpay";

export interface EcpayImportRow {
  sourceRow: number;
  giftDate: string;
  amount: number;
  merchantOrder: string;
  sourceTransaction: string | null;
  authNumber: string | null;
  issuingBank: string | null;
  responseCode: string | null;
  sourceDonor: string | null;
  sourcePhone: string | null;
  sourceEmail: string | null;
  sourceTradeDesc: string | null;
  rawData: Record<string, string>;
}

export interface EcpayParseResult {
  rows: EcpayImportRow[];
  skipped: string[];
}

const DATE_COLUMNS = [
  "訂單日期",
  "付款狀態",
  "paymentdate",
  "payment date",
  "paidat",
  "paid at",
  "tradedate",
  "trade date",
  "merchanttradedate",
  "merchant trade date",
  "date",
];

const AMOUNT_COLUMNS = [
  "交易金額",
  "tradeamt",
  "trade amount",
  "amount",
  "amt",
  "金額",
];

const MERCHANT_ORDER_COLUMNS = [
  "廠商訂單編號",
  "綠界訂單編號",
  "merchanttradeno",
  "merchant trade no",
  "ecpay trade no",
  "green world trade no",
  "merchant_order_no",
  "merchant order no",
  "merchant order",
  "order no",
  "orderno",
];

const TRANSACTION_COLUMNS = [
  "綠界訂單編號",
  "tradeno",
  "trade no",
  "source transaction",
  "transaction id",
  "交易編號",
];

const ORDER_INFO_COLUMNS = [
  "備註",
  "廠商備註",
  "orderinfo",
  "order info",
  "customfield1",
  "custom field1",
  "custom field 1",
];

const DONOR_COLUMNS = [
  "付款人姓名",
  "收件人姓名",
  "cardholder",
  "card holder",
  "donor",
  "donor name",
  "name",
  "姓名",
];

const PHONE_COLUMNS = [
  "付款人手機",
  "收件人手機",
  "phonenumber",
  "phone number",
  "phone",
  "電話",
];

const EMAIL_COLUMNS = [
  "付款人email",
  "收件人email",
  "email",
  "e-mail",
  "mail",
];

const TRADE_DESC_COLUMNS = [
  "商品名稱",
  "交易描述",
  "tradedesc",
  "trade desc",
  "trade description",
  "description",
  "品名",
];

const PAYMENT_METHOD_COLUMNS = ["付款方式", "payment method", "paymentmethod"];

const AUTH_COLUMNS = ["信用卡授權單號", "authcode", "auth code", "authnumber", "auth number", "授權碼"];
const BANK_COLUMNS = ["gwsr", "issuingbank", "issuing bank", "bank", "銀行"];
const RESPONSE_COLUMNS = ["付款狀態", "rtncode", "rtn code", "responsecode", "response code", "回應碼"];

function normalizeHeader(value: string): string {
  return value.trim().replace(/^\uFEFF/, "").replace(/[_-]+/g, " ").replace(/\s+/g, " ").toLowerCase();
}

function compact(value: string): string {
  return normalizeHeader(value).replace(/[^a-z0-9\u4e00-\u9fff]/g, "");
}

function findValue(row: Record<string, string>, aliases: string[]): string {
  const normalizedAliases = aliases.map(normalizeHeader);
  const compactAliases = aliases.map(compact);
  for (const [key, value] of Object.entries(row)) {
    const normalizedKey = normalizeHeader(key);
    if (normalizedAliases.includes(normalizedKey)) {
      const cleaned = cleanCell(value);
      if (cleaned) return cleaned;
    }
  }
  for (const [key, value] of Object.entries(row)) {
    const compactKey = compact(key);
    if (compactAliases.includes(compactKey)) {
      const cleaned = cleanCell(value);
      if (cleaned) return cleaned;
    }
  }
  return "";
}

function cleanCell(value: string | undefined): string {
  let text = (value ?? "").trim().replace(/^\uFEFF/, "");
  if (text.startsWith("=")) text = text.slice(1).trim();
  if (text.length >= 2 && text.startsWith('"') && text.endsWith('"')) {
    text = text.slice(1, -1).replace(/""/g, '"').trim();
  }
  return text === "-" ? "" : text;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

function parseAmount(raw: string): number | null {
  const cleaned = raw.replace(/[^0-9.-]/g, "");
  if (!cleaned) return null;
  const amount = Number(cleaned);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return Math.round(amount);
}

function parseDate(raw: string): string | null {
  const value = raw.trim();
  const ymd = value.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (ymd) return `${ymd[1]}-${ymd[2].padStart(2, "0")}-${ymd[3].padStart(2, "0")}`;
  const ymdCompact = value.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (ymdCompact) return `${ymdCompact[1]}-${ymdCompact[2]}-${ymdCompact[3]}`;
  const slash = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (slash) return `${slash[3]}-${slash[1].padStart(2, "0")}-${slash[2].padStart(2, "0")}`;
  return null;
}

function parseOrderInfo(raw: string): {
  donor: string | null;
  phone: string | null;
  tradeDesc: string | null;
} {
  const value = raw.replace(/\[BR\]/gi, "\n");
  const pick = (label: string) => {
    const match = value.match(new RegExp(`${label}\\s*:\\s*(.+?)(?:\\n|$)`, "i"));
    return match?.[1]?.trim() || null;
  };
  return {
    donor: pick("cardholder"),
    phone: pick("phonenumber"),
    tradeDesc: pick("tradedesc"),
  };
}

export function buildEcpayNotes(row: EcpayImportRow, donorReason: string): string {
  const value = (text: string | null) => text?.trim() || "(blank)";
  return [
    "[ECPay source]",
    `Source donor: ${value(row.sourceDonor)}`,
    `Source phone: ${value(row.sourcePhone)}`,
    `Source email: ${value(row.sourceEmail)}`,
    `Source transaction: ${value(row.sourceTransaction)}`,
    `Source tradedesc: ${value(row.sourceTradeDesc)}`,
    `ECPay merchant order: ${value(row.merchantOrder)}`,
    `ECPay auth number: ${value(row.authNumber)}`,
    `ECPay issuing bank: ${value(row.issuingBank)}`,
    `ECPay response code: ${value(row.responseCode)}`,
    `Suggested match: ${donorReason === "matched" ? "existing donor" : "(manual review)"}`,
    `Suggested reason: ${donorReason}`,
    "[Donor import review]",
  ].join("\n");
}

export function parseEcpayCSV(text: string): EcpayParseResult {
  const lines = text.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) return { rows: [], skipped: ["CSV has fewer than 2 lines."] };

  const headers = parseCSVLine(lines[0]).map(cleanCell);
  const rows: EcpayImportRow[] = [];
  const skipped: string[] = [];

  for (let index = 1; index < lines.length; index++) {
    const cells = parseCSVLine(lines[index]);
    const rawData = Object.fromEntries(headers.map((header, cellIndex) => [header, cleanCell(cells[cellIndex])]));
    const orderInfo = parseOrderInfo(findValue(rawData, ORDER_INFO_COLUMNS));

    const paymentMethod = findValue(rawData, PAYMENT_METHOD_COLUMNS);
    const merchantOrder = findValue(rawData, MERCHANT_ORDER_COLUMNS);
    const giftDate = parseDate(findValue(rawData, DATE_COLUMNS));
    const amount = parseAmount(findValue(rawData, AMOUNT_COLUMNS));
    const sourceTradeDesc = findValue(rawData, TRADE_DESC_COLUMNS) || orderInfo.tradeDesc;

    if (paymentMethod && !/card|信用卡/i.test(paymentMethod)) {
      skipped.push(`Row ${index + 1}: skipped non-card payment method.`);
      continue;
    }
    if (!merchantOrder) {
      skipped.push(`Row ${index + 1}: missing merchant order number.`);
      continue;
    }
    if (!giftDate) {
      skipped.push(`Row ${index + 1}: missing or invalid payment date.`);
      continue;
    }
    if (!amount) {
      skipped.push(`Row ${index + 1}: missing or invalid amount.`);
      continue;
    }

    rows.push({
      sourceRow: index + 1,
      giftDate,
      amount,
      merchantOrder,
      sourceTransaction: findValue(rawData, TRANSACTION_COLUMNS) || null,
      authNumber: findValue(rawData, AUTH_COLUMNS) || null,
      issuingBank: findValue(rawData, BANK_COLUMNS) || null,
      responseCode: findValue(rawData, RESPONSE_COLUMNS) || null,
      sourceDonor: findValue(rawData, DONOR_COLUMNS) || orderInfo.donor,
      sourcePhone: findValue(rawData, PHONE_COLUMNS) || orderInfo.phone,
      sourceEmail: findValue(rawData, EMAIL_COLUMNS).toLowerCase() || null,
      sourceTradeDesc,
      rawData,
    });
  }

  return { rows, skipped };
}

export function expectedCampusAndFund(row: EcpayImportRow): { campus: string; fund: string } {
  return inferEcpayClassification(row.sourceTradeDesc) ?? { campus: "TIF System", fund: "General" };
}
