"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
const CATEGORIES = ["ministry", "facilities", "staffing", "missions", "vbs", "worship", "admin", "other"] as const;
const BANK_DETAILS_STORAGE_KEY = "tif-finance-public-bank-details";

type SavedBankDetails = {
  email: string;
  bank_code: string;
  bank_account_number: string;
};

type LocaleLabels = {
  title: string; subtitle: string; name: string; email: string;
  campus: string; category: string; description: string; descHint: string;
  amount: string; date: string; notes: string; notesHint: string;
  paymentType: string; reimbursement: string; pettyCash: string; mobileTransfer: string;
  bankCode: string; bankAccountNumber: string; bankHint: string;
  pettyCashHint: string; mobileTransferHint: string;
  savedBankDetailsHint: string;
  submit: string; submitting: string; successTitle: string; successMsg: string;
  submitAnother: string; selectCampus: string; selectCategory: string;
  categories: Record<string, string>;
  errors: Record<string, string>;
};

const LABELS: Record<string, LocaleLabels> = {
  en: {
    title:       "Expense / Reimbursement Request",
    subtitle:    "Submit an expense or request reimbursement. A finance team member will review your submission.",
    name:        "Your Name",
    email:       "Email Address",
    campus:      "Campus",
    category:    "Expense Category",
    description: "Description",
    descHint:    "What was the expense for?",
    amount:      "Amount (NT$)",
    date:        "Expense Date",
    notes:       "Additional Notes",
    notesHint:   "Optional — receipts, context, or any other details",
    paymentType: "Payment Type",
    reimbursement: "Reimbursement",
    pettyCash:   "Paid from petty cash",
    mobileTransfer: "Transferred from TIF account via mobile",
    bankCode:    "Bank Code",
    bankAccountNumber: "Bank Account Number",
    bankHint:    "Required for reimbursement by bank transfer",
    pettyCashHint: "No bank details needed",
    mobileTransferHint: "No bank details needed",
    savedBankDetailsHint: "Saved bank details from a previous submission were filled in on this device.",
    submit:      "Submit Request",
    submitting:  "Submitting…",
    successTitle:"Request Submitted",
    successMsg:  "Your expense request has been received. The campus finance team will follow up with you.",
    submitAnother: "Submit Another",
    selectCampus: "Select a campus…",
    selectCategory: "Select a category…",
    categories: {
      ministry:   "Ministry",
      facilities: "Facilities",
      staffing:   "Staffing",
      missions:   "Missions",
      vbs:        "VBS / Children",
      worship:    "Worship",
      admin:      "Administration",
      other:      "Other",
    },
    errors: {
      name:        "Name is required",
      email:       "Valid email is required",
      campus:      "Please select a campus",
      category:    "Please select a category",
      description: "Description is required",
      amount:      "Please enter a valid amount",
      date:        "Date is required",
      paymentType: "Please select a payment type",
      bankCode:    "Bank code is required for reimbursements",
      bankAccountNumber: "Bank account number is required for reimbursements",
      server:      "Something went wrong. Please try again.",
    },
  },
  "zh-TW": {
    title:       "費用申請 / 請款",
    subtitle:    "提交費用申請或請款。財務團隊成員將審核您的申請。",
    name:        "姓名",
    email:       "電子郵件",
    campus:      "教區",
    category:    "費用類別",
    description: "說明",
    descHint:    "這筆費用的用途為何？",
    amount:      "金額（新台幣）",
    date:        "費用日期",
    notes:       "備註",
    notesHint:   "選填 — 收據、背景說明或其他細節",
    paymentType: "付款方式",
    reimbursement: "請款匯款",
    pettyCash:   "零用金已支付",
    mobileTransfer: "已由 TIF 帳戶手機轉帳",
    bankCode:    "銀行代碼",
    bankAccountNumber: "銀行帳號",
    bankHint:    "請款匯款時必填",
    pettyCashHint: "不需要填寫銀行資料",
    mobileTransferHint: "不需要填寫銀行資料",
    savedBankDetailsHint: "已自動帶入這台裝置上先前提交過的銀行資料。",
    submit:      "提交申請",
    submitting:  "提交中…",
    successTitle:"申請已送出",
    successMsg:  "您的費用申請已收到。教區財務團隊將與您聯繫。",
    submitAnother: "再次提交",
    selectCampus: "請選擇教區…",
    selectCategory: "請選擇類別…",
    categories: {
      ministry:   "事工",
      facilities: "設施",
      staffing:   "人事",
      missions:   "宣教",
      vbs:        "兒童主日學",
      worship:    "敬拜",
      admin:      "行政",
      other:      "其他",
    },
    errors: {
      name:        "姓名為必填",
      email:       "請輸入有效電子郵件",
      campus:      "請選擇教區",
      category:    "請選擇類別",
      description: "說明為必填",
      amount:      "請輸入有效金額",
      date:        "日期為必填",
      paymentType: "請選擇付款方式",
      bankCode:    "請款匯款需填寫銀行代碼",
      bankAccountNumber: "請款匯款需填寫銀行帳號",
      server:      "發生錯誤，請重試。",
    },
  },
};

export default function SubmitExpensePage() {
  const { locale } = useParams<{ locale: string }>();
  const lang = locale === "zh-TW" ? "zh-TW" : "en";
  const t = LABELS[lang];
  const otherLang = lang === "en" ? "zh-TW" : "en";
  const otherLabel = lang === "en" ? "中文" : "English";

  const [campuses, setCampuses] = useState<string[]>([]);
  const [form, setForm] = useState({
    name: "", email: "", campus_name: "", category: "",
    description: "", amount: "", expense_date: "", notes: "",
    payment_type: "reimbursement", bank_code: "", bank_account_number: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [serverError, setServerError] = useState("");
  const [savedBankDetails, setSavedBankDetails] = useState<SavedBankDetails | null>(null);
  const [didAutofillSavedBankDetails, setDidAutofillSavedBankDetails] = useState(false);

  useEffect(() => {
    fetch("/api/campuses").then(r => r.json()).then(setCampuses).catch(() => {});
  }, []);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(BANK_DETAILS_STORAGE_KEY);
      if (!saved) return;
      const parsed = JSON.parse(saved) as Partial<SavedBankDetails>;
      if (
        typeof parsed.email === "string" &&
        typeof parsed.bank_code === "string" &&
        typeof parsed.bank_account_number === "string" &&
        parsed.email &&
        parsed.bank_code &&
        parsed.bank_account_number
      ) {
        setSavedBankDetails({
          email: parsed.email.toLowerCase(),
          bank_code: parsed.bank_code,
          bank_account_number: parsed.bank_account_number,
        });
      }
    } catch {
      window.localStorage.removeItem(BANK_DETAILS_STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    if (!savedBankDetails) return;
    if (form.payment_type !== "reimbursement") return;
    if (form.bank_code || form.bank_account_number) return;

    const normalizedEmail = form.email.trim().toLowerCase();
    if (!normalizedEmail || normalizedEmail !== savedBankDetails.email) return;

    setForm((current) => ({
      ...current,
      bank_code: savedBankDetails.bank_code,
      bank_account_number: savedBankDetails.bank_account_number,
    }));
    setDidAutofillSavedBankDetails(true);
  }, [form.email, form.payment_type, form.bank_code, form.bank_account_number, savedBankDetails]);

  function set(field: string, value: string) {
    setForm(f => {
      if (field === "payment_type" && value !== "reimbursement") {
        return { ...f, payment_type: value, bank_code: "", bank_account_number: "" };
      }
      return { ...f, [field]: value };
    });
    setErrors(e => {
      const n = { ...e };
      delete n[field];
      if (field === "payment_type") {
        delete n.bank_code;
        delete n.bank_account_number;
      }
      return n;
    });
  }

  function validate() {
    const errs: Record<string, string> = {};
    if (!form.name.trim())        errs.name        = t.errors.name;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = t.errors.email;
    if (!form.campus_name)        errs.campus_name = t.errors.campus;
    if (!form.category)           errs.category    = t.errors.category;
    if (!form.description.trim()) errs.description = t.errors.description;
    if (!form.amount || Number(form.amount) <= 0) errs.amount = t.errors.amount;
    if (!form.expense_date)       errs.expense_date = t.errors.date;
    if (!form.payment_type)       errs.payment_type = t.errors.paymentType;
    if (form.payment_type === "reimbursement" && !form.bank_code.trim())
      errs.bank_code = t.errors.bankCode;
    if (form.payment_type === "reimbursement" && !form.bank_account_number.trim())
      errs.bank_account_number = t.errors.bankAccountNumber;
    return errs;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setStatus("submitting");
    try {
      const res = await fetch("/api/public-expense", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(form),
      });
      if (res.ok) {
        if (form.payment_type === "reimbursement") {
          const detailsToSave = {
            email: form.email.trim().toLowerCase(),
            bank_code: form.bank_code.trim(),
            bank_account_number: form.bank_account_number.trim(),
          };
          window.localStorage.setItem(BANK_DETAILS_STORAGE_KEY, JSON.stringify(detailsToSave));
          setSavedBankDetails(detailsToSave);
        }
        setStatus("success");
      } else {
        const data = await res.json().catch(() => ({}));
        setServerError(data.error ?? t.errors.server);
        setStatus("error");
      }
    } catch {
      setServerError(t.errors.server);
      setStatus("error");
    }
  }

  function reset() {
    setForm({
      name: "", email: "", campus_name: "", category: "",
      description: "", amount: "", expense_date: "", notes: "",
      payment_type: "reimbursement", bank_code: "", bank_account_number: "",
    });
    setErrors({});
    setStatus("idle");
    setServerError("");
    setDidAutofillSavedBankDetails(false);
  }

  if (status === "success") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-200 p-8 max-w-md w-full text-center">
          <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">{t.successTitle}</h2>
          <p className="text-gray-500 mb-6">{t.successMsg}</p>
          <button onClick={reset} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
            {t.submitAnother}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <p className="text-xs font-medium text-blue-600 uppercase tracking-wider mb-1">
              Taichung International Fellowship
            </p>
            <h1 className="text-2xl font-semibold text-gray-900">{t.title}</h1>
            <p className="text-sm text-gray-500 mt-1">{t.subtitle}</p>
          </div>
          <a
            href={`/${otherLang}/submit`}
            className="text-xs text-gray-400 hover:text-gray-600 mt-1 shrink-0"
          >
            {otherLabel}
          </a>
        </div>

        <form onSubmit={handleSubmit} noValidate className="bg-white rounded-xl shadow-sm ring-1 ring-gray-200 p-6 space-y-5">

          {/* Name + Email */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.name} <span className="text-red-500">*</span></label>
              <input
                type="text" value={form.name}
                onChange={e => set("name", e.target.value)}
                className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.name ? "border-red-400" : "border-gray-300"}`}
              />
              {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.email} <span className="text-red-500">*</span></label>
              <input
                type="email" value={form.email}
                onChange={e => set("email", e.target.value)}
                className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.email ? "border-red-400" : "border-gray-300"}`}
              />
              {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
            </div>
          </div>

          {/* Campus + Category */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.campus} <span className="text-red-500">*</span></label>
              <select
                value={form.campus_name}
                onChange={e => set("campus_name", e.target.value)}
                className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white ${errors.campus_name ? "border-red-400" : "border-gray-300"}`}
              >
                <option value="">{t.selectCampus}</option>
                {campuses.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              {errors.campus_name && <p className="text-xs text-red-500 mt-1">{errors.campus_name}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.category} <span className="text-red-500">*</span></label>
              <select
                value={form.category}
                onChange={e => set("category", e.target.value)}
                className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white ${errors.category ? "border-red-400" : "border-gray-300"}`}
              >
                <option value="">{t.selectCategory}</option>
                {CATEGORIES.map(c => (
                  <option key={c} value={c}>{t.categories[c]}</option>
                ))}
              </select>
              {errors.category && <p className="text-xs text-red-500 mt-1">{errors.category}</p>}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t.description} <span className="text-red-500">*</span></label>
            <textarea
              value={form.description}
              onChange={e => set("description", e.target.value)}
              rows={3}
              placeholder={t.descHint}
              className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none ${errors.description ? "border-red-400" : "border-gray-300"}`}
            />
            {errors.description && <p className="text-xs text-red-500 mt-1">{errors.description}</p>}
          </div>

          {/* Amount + Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.amount} <span className="text-red-500">*</span></label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">NT$</span>
                <input
                  type="number" min="1" step="1" value={form.amount}
                  onChange={e => set("amount", e.target.value)}
                  className={`w-full rounded-lg border pl-10 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.amount ? "border-red-400" : "border-gray-300"}`}
                />
              </div>
              {errors.amount && <p className="text-xs text-red-500 mt-1">{errors.amount}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.date} <span className="text-red-500">*</span></label>
              <input
                type="date" value={form.expense_date}
                onChange={e => set("expense_date", e.target.value)}
                className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.expense_date ? "border-red-400" : "border-gray-300"}`}
              />
              {errors.expense_date && <p className="text-xs text-red-500 mt-1">{errors.expense_date}</p>}
            </div>
          </div>

          {/* Payment Type */}
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{t.paymentType} <span className="text-red-500">*</span></label>
              <div className="grid grid-cols-1 gap-3">
                <label className={`rounded-lg border p-3 cursor-pointer transition ${form.payment_type === "reimbursement" ? "border-blue-500 bg-blue-50" : "border-gray-300 bg-white"}`}>
                  <div className="flex items-start gap-3">
                    <input
                      type="radio"
                      name="payment_type"
                      value="reimbursement"
                      checked={form.payment_type === "reimbursement"}
                      onChange={e => set("payment_type", e.target.value)}
                      className="mt-0.5"
                    />
                    <div>
                      <p className="text-sm font-medium text-gray-800">{t.reimbursement}</p>
                      <p className="text-xs text-gray-500 mt-1">{t.bankHint}</p>
                    </div>
                  </div>
                </label>
                <label className={`rounded-lg border p-3 cursor-pointer transition ${form.payment_type === "petty_cash" ? "border-blue-500 bg-blue-50" : "border-gray-300 bg-white"}`}>
                  <div className="flex items-start gap-3">
                    <input
                      type="radio"
                      name="payment_type"
                      value="petty_cash"
                      checked={form.payment_type === "petty_cash"}
                      onChange={e => set("payment_type", e.target.value)}
                      className="mt-0.5"
                    />
                    <div>
                      <p className="text-sm font-medium text-gray-800">{t.pettyCash}</p>
                      <p className="text-xs text-gray-500 mt-1">{t.pettyCashHint}</p>
                    </div>
                  </div>
                </label>
                <label className={`rounded-lg border p-3 cursor-pointer transition ${form.payment_type === "mobile_transfer" ? "border-blue-500 bg-blue-50" : "border-gray-300 bg-white"}`}>
                  <div className="flex items-start gap-3">
                    <input
                      type="radio"
                      name="payment_type"
                      value="mobile_transfer"
                      checked={form.payment_type === "mobile_transfer"}
                      onChange={e => set("payment_type", e.target.value)}
                      className="mt-0.5"
                    />
                    <div>
                      <p className="text-sm font-medium text-gray-800">{t.mobileTransfer}</p>
                      <p className="text-xs text-gray-500 mt-1">{t.mobileTransferHint}</p>
                    </div>
                  </div>
                </label>
              </div>
              {errors.payment_type && <p className="text-xs text-red-500 mt-1">{errors.payment_type}</p>}
            </div>

            {form.payment_type === "reimbursement" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t.bankCode} <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={form.bank_code}
                    onChange={e => set("bank_code", e.target.value)}
                    className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.bank_code ? "border-red-400" : "border-gray-300"}`}
                  />
                  {errors.bank_code && <p className="text-xs text-red-500 mt-1">{errors.bank_code}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t.bankAccountNumber} <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={form.bank_account_number}
                    onChange={e => set("bank_account_number", e.target.value)}
                    className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.bank_account_number ? "border-red-400" : "border-gray-300"}`}
                  />
                  {errors.bank_account_number && <p className="text-xs text-red-500 mt-1">{errors.bank_account_number}</p>}
                </div>
                {didAutofillSavedBankDetails && (
                  <p className="sm:col-span-2 text-xs text-amber-800">
                    {t.savedBankDetailsHint}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t.notes}</label>
            <textarea
              value={form.notes}
              onChange={e => set("notes", e.target.value)}
              rows={2}
              placeholder={t.notesHint}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          {status === "error" && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{serverError}</p>
          )}

          <button
            type="submit"
            disabled={status === "submitting"}
            className="w-full py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {status === "submitting" ? t.submitting : t.submit}
          </button>
        </form>

        <p className="text-center text-xs text-gray-400 mt-6">
          Taichung International Fellowship · Finance System
        </p>
      </div>
    </div>
  );
}
