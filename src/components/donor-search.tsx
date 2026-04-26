"use client";

import { useState, useRef, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { searchDonors, createDonorAndReturn } from "@/app/actions/donations";

interface Donor {
  id: string;
  display_name: string;
  email: string | null;
}

interface DonorSearchProps {
  value: string | null;
  onChange: (donorId: string | null, displayName: string) => void;
  initialDonorId?: string | null;
  initialDonorName?: string | null;
}

export function DonorSearch({ onChange, initialDonorId, initialDonorName }: DonorSearchProps) {
  const t = useTranslations("donations");
  const [query, setQuery] = useState(initialDonorName ?? "");
  const [results, setResults] = useState<Donor[]>([]);
  const [selected, setSelected] = useState<string | null>(initialDonorId ?? null);
  const [selectedName, setSelectedName] = useState(initialDonorName ?? "");
  const [showDropdown, setShowDropdown] = useState(false);
  const [creating, setCreating] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(async () => {
      const data = await searchDonors(query);
      setResults(data as Donor[]);
      setShowDropdown(true);
    }, 250);
  }, [query]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function select(donor: Donor) {
    setSelected(donor.id);
    setSelectedName(donor.display_name);
    setQuery(donor.display_name);
    setShowDropdown(false);
    onChange(donor.id, donor.display_name);
  }

  function clearSelection() {
    setSelected(null);
    setSelectedName("");
    setQuery("");
    onChange(null, "");
  }

  async function handleCreateNew() {
    if (!query.trim()) return;
    setCreating(true);
    const donor = await createDonorAndReturn(query.trim());
    setCreating(false);
    if (donor) {
      select(donor as Donor);
    }
  }

  return (
    <div ref={ref} className="relative">
      {selected ? (
        <div className="flex items-center gap-2 h-9 px-3 border rounded-md bg-secondary/50 text-sm">
          <span className="flex-1">{selectedName}</span>
          <button
            type="button"
            onClick={clearSelection}
            className="text-gray-400 hover:text-gray-600 text-xs"
          >
            ✕
          </button>
        </div>
      ) : (
        <Input
          value={query}
          onChange={(e) => { setQuery(e.target.value); setShowDropdown(true); }}
          placeholder={t("searchDonor")}
          autoComplete="off"
        />
      )}

      {showDropdown && query && !selected && (
        <div className="absolute z-10 mt-1 w-full bg-white border rounded-md shadow-lg max-h-60 overflow-auto text-sm">
          {results.map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => select(d)}
              className="w-full text-left px-3 py-2 hover:bg-gray-50 flex flex-col"
            >
              <span className="font-medium">{d.display_name}</span>
              {d.email && <span className="text-gray-400 text-xs">{d.email}</span>}
            </button>
          ))}
          <button
            type="button"
            onClick={handleCreateNew}
            disabled={creating}
            className="w-full text-left px-3 py-2 hover:bg-blue-50 text-blue-600 border-t font-medium"
          >
            {creating ? "Creating…" : `+ ${t("newDonor")}: "${query}"`}
          </button>
        </div>
      )}

      {/* Hidden input carries the donor_id value for the form */}
      <input type="hidden" name="donor_id" value={selected ?? ""} />
    </div>
  );
}
