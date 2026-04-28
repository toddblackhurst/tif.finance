// Auto-generated types can be added here with: npx supabase gen types typescript
// For now, basic type stubs are provided; replace with generated types after schema is applied.

export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export type UserRole = "admin" | "campus-finance" | "viewer";
export type PaymentMethod = "cash" | "card" | "bank_transfer" | "check" | "other";
export type ExpenseStatus = "draft" | "submitted" | "approved" | "rejected" | "paid";
export type DonorType = "individual" | "household" | "business" | "anonymous";
export type MatchStatus = "unmatched" | "matched" | "ignored";
export type AuditAction = "create" | "update" | "delete" | "restore";

export interface Database {
  public: {
    Tables: {
      campuses: {
        Row: {
          id: string;
          name: string;
          name_zh: string | null;
          is_active: boolean;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["campuses"]["Row"], "id" | "created_at"> & { id?: string };
        Update: Partial<Database["public"]["Tables"]["campuses"]["Insert"]>;
      };
      funds: {
        Row: {
          id: string;
          name: string;
          name_zh: string | null;
          description: string | null;
          is_restricted: boolean;
          is_active: boolean;
          accounting_code: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["funds"]["Row"], "id" | "created_at" | "updated_at"> & { id?: string };
        Update: Partial<Database["public"]["Tables"]["funds"]["Insert"]>;
      };
      user_profiles: {
        Row: {
          id: string;
          full_name: string | null;
          email: string | null;
          phone: string | null;
          role: UserRole;
          assigned_campus_id: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["user_profiles"]["Row"], "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["user_profiles"]["Insert"]>;
      };
      donors: {
        Row: {
          id: string;
          pco_contact_id: string | null;
          display_name: string;
          first_name: string | null;
          last_name: string | null;
          email: string | null;
          phone: string | null;
          donor_type: DonorType;
          preferred_campus_id: string | null;
          notes: string | null;
          merged_into_id: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: Omit<Database["public"]["Tables"]["donors"]["Row"], "id" | "created_at" | "updated_at"> & { id?: string };
        Update: Partial<Database["public"]["Tables"]["donors"]["Insert"]>;
      };
      donations: {
        Row: {
          id: string;
          donor_id: string | null;
          gift_date: string;
          amount: number;
          campus_id: string;
          fund_id: string;
          payment_method: PaymentMethod;
          deposit_reference: string | null;
          pco_gift_id: string | null;
          receipt_url: string | null;
          notes: string | null;
          thank_you_sent_at: string | null;
          entered_by_id: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: Omit<Database["public"]["Tables"]["donations"]["Row"], "id" | "created_at" | "updated_at"> & { id?: string };
        Update: Partial<Database["public"]["Tables"]["donations"]["Insert"]>;
      };
      expenses: {
        Row: {
          id: string;
          submitter_id: string;
          description: string;
          category: string;
          expense_date: string;
          amount: number;
          campus_id: string;
          fund_id: string;
          payment_method: PaymentMethod | null;
          status: ExpenseStatus;
          approver_id: string | null;
          approved_at: string | null;
          approval_notes: string | null;
          paid_at: string | null;
          paid_by_id: string | null;
          check_number: string | null;
          reconciliation_ref: string | null;
          receipt_url: string | null;
          notes: string | null;
          payment_type: "reimbursement" | "petty_cash" | null;
          bank_code: string | null;
          bank_account_number: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: Omit<Database["public"]["Tables"]["expenses"]["Row"], "id" | "created_at" | "updated_at"> & { id?: string };
        Update: Partial<Database["public"]["Tables"]["expenses"]["Insert"]>;
      };
      budgets: {
        Row: {
          id: string;
          campus_id: string;
          fund_id: string;
          fiscal_year: number;
          fiscal_month: number;
          budgeted_amount: number;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["budgets"]["Row"], "id" | "created_at" | "updated_at"> & { id?: string };
        Update: Partial<Database["public"]["Tables"]["budgets"]["Insert"]>;
      };
      audit_log: {
        Row: {
          id: string;
          entity_type: string;
          entity_id: string;
          action: AuditAction;
          actor_id: string | null;
          before_snapshot: Json | null;
          after_snapshot: Json | null;
          change_summary: string | null;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["audit_log"]["Row"], "id" | "created_at"> & { id?: string };
        Update: never;
      };
      user_campus_assignments: {
        Row: {
          user_id: string;
          campus_id: string;
        };
        Insert: Database["public"]["Tables"]["user_campus_assignments"]["Row"];
        Update: Partial<Database["public"]["Tables"]["user_campus_assignments"]["Insert"]>;
      };
      bank_import_lines: {
        Row: {
          id: string;
          import_batch_id: string;
          imported_at: string;
          imported_by_id: string | null;
          transaction_date: string;
          amount: number;
          description: string | null;
          account_identifier: string | null;
          matched_donation_id: string | null;
          match_status: MatchStatus;
          raw_data: Json | null;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["bank_import_lines"]["Row"], "id" | "created_at"> & { id?: string };
        Update: Partial<Database["public"]["Tables"]["bank_import_lines"]["Insert"]>;
      };
    };
    Views: {
      donor_statistics: {
        Row: {
          id: string;
          display_name: string;
          email: string | null;
          phone: string | null;
          preferred_campus_id: string | null;
          preferred_campus: string | null;
          gift_count: number;
          ytd_amount: number;
          lifetime_amount: number;
          last_gift_date: string | null;
          avg_gift_amount: number | null;
        };
      };
      monthly_campus_rollup: {
        Row: {
          campus: string;
          fund: string;
          year: number;
          month: number;
          total_donations: number;
          donation_count: number;
        };
      };
      budget_variance: {
        Row: {
          campus: string;
          fund: string;
          fiscal_year: number;
          fiscal_month: number;
          budgeted_amount: number;
          actual_donations: number;
          variance: number;
        };
      };
    };
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}
