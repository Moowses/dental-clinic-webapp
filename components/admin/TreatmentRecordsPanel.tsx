"use client";

import React, { useEffect, useMemo, useState } from "react";

import { getPatientListAction } from "@/app/actions/patient-actions";
import { getPatientTreatmentHistoryAction } from "@/app/actions/appointment-admin-actions";
import { searchPatients, getUserDisplayNameByUid } from "@/lib/services/user-service";
import { auth } from "@/lib/firebase/firebase";
import { Odontogram } from "react-odontogram";

import type { UserProfile } from "@/lib/types/user";

const inputBase =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-300";

function Card({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100">
        <h3 className="text-lg font-extrabold text-slate-900">{title}</h3>
        {subtitle ? <p className="text-sm text-slate-500">{subtitle}</p> : null}
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

function toMillis(value: any) {
  if (!value) return 0;
  if (typeof value?.toDate === "function") return value.toDate().getTime();
  if (typeof value?.seconds === "number") return value.seconds * 1000;
  const d = new Date(value);
  const ms = d.getTime();
  return Number.isNaN(ms) ? 0 : ms;
}

function universalToFdi(universal: number) {
  if (universal >= 1 && universal <= 8) return 19 - universal;
  if (universal >= 9 && universal <= 16) return universal + 12;
  if (universal >= 17 && universal <= 24) return 55 - universal;
  if (universal >= 25 && universal <= 32) return universal + 16;
  return null;
}

function fdiToUniversal(fdi: number) {
  const map: Record<number, number> = {
    11: 8, 12: 7, 13: 6, 14: 5, 15: 4, 16: 3, 17: 2, 18: 1,
    21: 9, 22: 10, 23: 11, 24: 12, 25: 13, 26: 14, 27: 15, 28: 16,
    31: 24, 32: 23, 33: 22, 34: 21, 35: 20, 36: 19, 37: 18, 38: 17,
    41: 25, 42: 26, 43: 27, 44: 28, 45: 29, 46: 30, 47: 31, 48: 32,
  };
  return map[fdi] ?? null;
}

function normalizeChartKeys(
  chart: Record<string, { status?: string; notes?: string }>
) {
  const next: Record<string, { status?: string; notes?: string }> = {};
  Object.entries(chart || {}).forEach(([key, value]) => {
    const raw = String(key || "").trim();
    if (!raw) return;
    const num = Number(raw.replace("teeth-", ""));
    if (!Number.isFinite(num)) {
      next[raw] = value;
      return;
    }
    if (num >= 1 && num <= 32) {
      next[String(num)] = value;
      return;
    }
    if (num >= 11 && num <= 48) {
      const uni = fdiToUniversal(num);
      if (uni) {
        next[String(uni)] = value;
        return;
      }
    }
    next[raw] = value;
  });
  return next;
}

function keyToToothId(key: string) {
  const raw = String(key || "").trim();
  if (!raw) return null;
  if (raw.startsWith("teeth-")) return raw;
  const num = Number(raw);
  if (!Number.isFinite(num)) return null;
  if (num >= 1 && num <= 32) {
    const fdi = universalToFdi(num);
    return fdi ? `teeth-${fdi}` : null;
  }
  if (num >= 11 && num <= 48) return `teeth-${num}`;
  return null;
}

function payloadToUniversal(payload: any) {
  const raw = payload?.notations?.universal || payload?.notations?.fdi || "";
  if (!raw) return "";
  const num = Number(raw);
  if (Number.isFinite(num)) return String(num);
  return String(raw);
}

function keyToUniversal(key: string) {
  const raw = String(key || "").trim();
  if (!raw) return null;
  if (raw.startsWith("teeth-")) {
    const num = Number(raw.replace("teeth-", ""));
    if (!Number.isFinite(num)) return null;
    if (num >= 11 && num <= 48) {
      const uni = fdiToUniversal(num);
      return uni ? String(uni) : null;
    }
  }
  const num = Number(raw);
  if (!Number.isFinite(num)) return null;
  if (num >= 1 && num <= 32) return String(num);
  if (num >= 11 && num <= 48) {
    const uni = fdiToUniversal(num);
    return uni ? String(uni) : null;
  }
  return null;
}

function TreatmentHistoryModal({
  patientId,
  patientName,
  patientEmail,
  onClose,
}: {
  patientId: string;
  patientName?: string | null;
  patientEmail?: string | null;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState<
    Array<{
      appointmentId: string;
      dentistId?: string | null;
      dentistName?: string | null;
      date?: string;
      time?: string;
      completedAt?: any;
      notes?: string;
      procedures?: Array<{ name?: string; toothNumber?: string; price?: number | null }>;
      imageUrls?: string[];
      dentalChart?: Record<string, { status?: string; notes?: string }>;
    }>
  >([]);
  const [openAttachments, setOpenAttachments] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let active = true;
    setLoading(true);
    setGroups([]);

    const load = async () => {
      const user = auth.currentUser;
      const token = user ? await user.getIdToken() : null;
      if (!token) {
        if (!active) return;
        setLoading(false);
        return;
      }

      const res = await getPatientTreatmentHistoryAction({
        patientId,
        idToken: token,
      });

      if (!active) return;
      if (!res?.success || !res.data) {
        setGroups([]);
        setLoading(false);
        return;
      }

      const list = Array.isArray(res.data.groups) ? res.data.groups : [];
      const withNames = await Promise.all(
        list.map(async (g) => ({
          ...g,
          dentistName: g.dentistId ? await getUserDisplayNameByUid(g.dentistId) : null,
        }))
      );
      setGroups(withNames);
      setLoading(false);
    };

    load();
    return () => {
      active = false;
    };
  }, [patientId]);

  const formatLabel = (g: { date?: string; time?: string; completedAt?: any }) => {
    if (g.date && g.time) return `${g.date} ${g.time}`;
    if (g.date) return g.date;
    const ts = g.completedAt ? toMillis(g.completedAt) : 0;
    if (ts) return new Date(ts).toLocaleString();
    return "Unknown date";
  };

  const chartHistory = useMemo(() => {
    const map = new Map<
      string,
      Array<{ date: string; status?: string; notes?: string }>
    >();

    for (const g of groups) {
      const label = formatLabel(g);
      const chart = g.dentalChart || {};
      for (const [rawKey, entry] of Object.entries(chart)) {
        const uniKey = keyToUniversal(rawKey);
        if (!uniKey) continue;
        const status =
          (entry as any)?.status ??
          (entry as any)?.state ??
          (entry as any)?.condition ??
          "";
        const notes =
          (entry as any)?.notes ??
          (entry as any)?.note ??
          (entry as any)?.description ??
          "";
        if (!status && !notes) continue;
        const list = map.get(uniKey) ?? [];
        list.push({ date: label, status: String(status || ""), notes: String(notes || "") });
        map.set(uniKey, list);
      }
    }

    for (const list of map.values()) {
      list.sort((a, b) => String(b.date).localeCompare(String(a.date)));
    }

    return map;
  }, [groups]);

  const isExtractedEntry = (e: { status?: string; notes?: string }) => {
    const status = String(e.status || "").toLowerCase();
    const notes = String(e.notes || "").toLowerCase();
    return (
      status.includes("extract") ||
      status.includes("removed") ||
      status.includes("denture") ||
      notes.includes("extract") ||
      notes.includes("removed") ||
      notes.includes("denture")
    );
  };

  const extractedSet = new Set(
    Array.from(chartHistory.entries())
      .filter(([_, entries]) => entries.some((e) => isExtractedEntry(e)))
      .map(([key]) => keyToToothId(key))
      .filter(Boolean) as string[]
  );

  const notedSet = new Set(
    Array.from(chartHistory.entries())
      .filter(([key, entries]) => {
        if (extractedSet.has(keyToToothId(key) || "")) return false;
        return entries.some((e) => {
          const status = String(e.status || "").trim();
          const notes = String(e.notes || "").trim();
          return Boolean(status || notes);
        });
      })
      .map(([key]) => keyToToothId(key))
      .filter(Boolean) as string[]
  );

  const notedSelected = Array.from(notedSet);
  const extractedSelected = Array.from(extractedSet);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-6xl rounded-2xl bg-white border border-slate-200 shadow-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-extrabold text-slate-900">Treatment Records</h3>
            <p className="text-sm text-slate-500">
              {patientName ? `${patientName}` : "Patient"} {patientEmail ? `• ${patientEmail}` : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-extrabold text-slate-700 hover:bg-slate-50"
          >
            Close
          </button>
        </div>

        <div className="p-5 max-h-[85vh] overflow-y-auto">
          {loading ? (
            <p className="text-sm text-slate-500">Loading...</p>
          ) : groups.length === 0 ? (
            <p className="text-sm text-slate-500">No treatment history found.</p>
          ) : (
            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-xs font-extrabold uppercase tracking-widest text-slate-600">
                  Dental Chart (combined history)
                </p>
                <div className="mt-2 grid gap-2 text-xs text-slate-600 sm:grid-cols-3">
                  <div className="inline-flex items-center gap-2">
                    <span className="inline-block h-2.5 w-2.5 rounded-full bg-amber-400" />
                    Teeth with notes
                  </div>
                  <div className="inline-flex items-center gap-2">
                    <span className="inline-block h-2.5 w-2.5 rounded-full bg-slate-900" />
                    Extracted / removed / dentures
                  </div>
                  <div className="inline-flex items-center gap-2">
                    Hover teeth to view history
                  </div>
                </div>
                <p className="mt-2 text-[11px] text-slate-500">
                  Highlighted teeth: {Array.from(chartHistory.keys()).join(", ") || "—"}
                </p>

                <div className="mt-3 relative">
                  <div className="opacity-90">
                    <Odontogram
                      key={`combined-extracted-${extractedSelected.join(",")}`}
                      defaultSelected={extractedSelected}
                      theme="light"
                      colors={{ lightBlue: "#0f172a", darkBlue: "#0f172a", baseBlue: "#0f172a" }}
                      tooltip={{ content: () => null }}
                      showTooltip={false}
                    />
                  </div>
                  <div className="absolute inset-0">
                    <Odontogram
                      key={`combined-notes-${notedSelected.join(",")}`}
                      defaultSelected={notedSelected}
                      theme="light"
                      colors={{ lightBlue: "#fbbf24", darkBlue: "#f59e0b", baseBlue: "#fde68a" }}
                      showTooltip={true}
                      tooltip={{
                        content: (payload: any) => {
                          const key = payloadToUniversal(payload);
                          const entries = key ? chartHistory.get(key) || [] : [];
                          return (
                            <div>
                              <div>Tooth: {key || "—"}</div>
                              {entries.length ? (
                                <div className="mt-1 space-y-1">
                                  {entries.map((e, idx) => (
                                    <div key={`${key}-${idx}`}>
                                      <div>{e.date}</div>
                                        <div>
                                          Status: {e.status || "—"}
                                          {isExtractedEntry(e) ? " (Extracted)" : ""}
                                        </div>
                                      <div>Notes: {e.notes || "—"}</div>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div>No history</div>
                              )}
                            </div>
                          );
                        },
                      }}
                    />
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-xs font-extrabold uppercase tracking-widest text-slate-600">
                  Treatment History
                </p>
                <div className="mt-3 space-y-3">
                  {groups.map((g) => (
                    <div key={g.appointmentId} className="rounded-xl border border-slate-200 bg-white p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-extrabold text-slate-900">
                            {formatLabel(g)}
                          </p>
                          <p className="text-xs text-slate-500">
                            Dentist: {g.dentistName || "—"}
                          </p>
                        </div>
                      </div>

                      {g.procedures && g.procedures.length ? (
                        <div className="mt-2 space-y-1 text-sm text-slate-700">
                          {g.procedures.map((p, idx) => (
                            <div key={`${g.appointmentId}-p-${idx}`} className="flex items-center justify-between">
                              <span className="truncate">{p.name || "Procedure"}</span>
                              <span className="text-xs text-slate-500">
                                {p.toothNumber ? `Tooth ${p.toothNumber}` : ""}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-2 text-xs text-slate-500">No procedures recorded.</p>
                      )}

                      {g.notes ? (
                        <div className="mt-2 text-xs text-slate-700">
                          <span className="font-extrabold">Notes:</span> {g.notes}
                        </div>
                      ) : null}

                      {g.imageUrls && g.imageUrls.length ? (
                        <div className="mt-3">
                          <button
                            type="button"
                            onClick={() =>
                              setOpenAttachments((prev) => ({
                                ...prev,
                                [g.appointmentId]: !prev[g.appointmentId],
                              }))
                            }
                            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-extrabold text-slate-700 hover:bg-slate-50"
                          >
                            {openAttachments[g.appointmentId] ? "Hide attachments" : "Show attachments"}
                          </button>

                          {openAttachments[g.appointmentId] ? (
                            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                              {g.imageUrls.map((url, idx) => (
                                <a
                                  key={`${g.appointmentId}-${idx}`}
                                  href={url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="block"
                                >
                                  <img
                                    src={url}
                                    alt={`Attachment ${idx + 1}`}
                                    loading="lazy"
                                    className="h-24 w-full rounded-xl border border-slate-200 object-cover"
                                  />
                                </a>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function TreatmentRecordsPanel() {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searching, setSearching] = useState(false);

  const [directory, setDirectory] = useState<UserProfile[]>([]);
  const [dirLoading, setDirLoading] = useState(true);

  const [treatmentUid, setTreatmentUid] = useState<string | null>(null);
  const [treatmentName, setTreatmentName] = useState<string | null>(null);
  const [treatmentEmail, setTreatmentEmail] = useState<string | null>(null);

  useEffect(() => {
    setDirLoading(true);
    getPatientListAction().then((res: any) => {
      if (res?.success) setDirectory(res.data || []);
      setDirLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const t = setTimeout(async () => {
      setSearching(true);
      const res = await searchPatients(searchQuery);
      if (res.success) setSearchResults(res.data || []);
      setShowDropdown(true);
      setSearching(false);
    }, 250);

    return () => clearTimeout(t);
  }, [searchQuery]);

  const tableRows = useMemo(() => {
    if (searchQuery.trim()) return searchResults;
    return directory;
  }, [searchQuery, searchResults, directory]);

  return (
    <Card title="Treatment Records" subtitle="View patient treatment history, charts, and attachments">
      <div className="space-y-3">
        <div className="relative">
          <input
            className={inputBase}
            placeholder="Search patient by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setShowDropdown(true)}
          />

          {showDropdown && searchQuery.trim() && (searching || searchResults.length > 0) && (
            <ul className="absolute z-10 w-full bg-white border border-slate-200 rounded-2xl shadow-lg max-h-60 overflow-y-auto mt-2">
              {searching && <li className="p-3 text-sm text-slate-500">Searching...</li>}
              {!searching &&
                searchResults.map((u) => (
                  <li
                    key={u.uid}
                    className="p-3 hover:bg-slate-50 cursor-pointer text-sm border-b border-slate-100 last:border-0"
                    onClick={() => {
                      setSearchQuery(u.displayName || u.email);
                      setShowDropdown(false);
                    }}
                  >
                    <div className="font-bold text-slate-900">{u.displayName || "No Name"}</div>
                    <div className="text-xs text-slate-500">{u.email}</div>
                  </li>
                ))}
            </ul>
          )}
        </div>

        <div className="pt-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-extrabold text-slate-700">
              {searchQuery.trim() ? "Search Results" : "Patient Directory (Staff)"}
            </p>
            <p className="text-[11px] text-slate-500">
              {searchQuery.trim()
                ? `${tableRows.length} result(s)`
                : dirLoading
                ? "Loading directory..."
                : `${tableRows.length} patient(s)`}
            </p>
          </div>

          <div className="mt-2 overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr className="text-left text-[11px] uppercase tracking-widest text-slate-500">
                  <th className="p-3">Name</th>
                  <th className="p-3 hidden md:table-cell">Email</th>
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {dirLoading && !searchQuery.trim() ? (
                  <tr>
                    <td className="p-3 text-slate-500" colSpan={3}>
                      Loading patient directory...
                    </td>
                  </tr>
                ) : tableRows.length === 0 ? (
                  <tr>
                    <td className="p-3 text-slate-500" colSpan={3}>
                      {searchQuery.trim() ? "No matching patients found." : "No patients found in directory."}
                    </td>
                  </tr>
                ) : (
                  tableRows.map((u) => (
                    <tr key={u.uid} className="border-t border-slate-100">
                      <td className="p-3">
                        <div className="font-bold text-slate-900">{u.displayName || "No Name"}</div>
                        <div className="text-xs text-slate-500 md:hidden">{u.email}</div>
                      </td>
                      <td className="p-3 hidden md:table-cell text-slate-700">{u.email}</td>
                      <td className="p-3">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => {
                              setTreatmentUid(u.uid);
                              setTreatmentName(u.displayName || u.email || null);
                              setTreatmentEmail(u.email || null);
                            }}
                            className="px-3 py-2 rounded-xl bg-teal-700 text-white font-extrabold text-xs hover:bg-teal-800"
                          >
                            View
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {searchQuery.trim() && (
            <button
              onClick={() => {
                setSearchQuery("");
                setSearchResults([]);
                setShowDropdown(false);
              }}
              className="mt-2 text-xs font-extrabold text-slate-600 hover:text-slate-900"
            >
              Clear search (back to directory)
            </button>
          )}
        </div>

        {treatmentUid && (
          <TreatmentHistoryModal
            patientId={treatmentUid}
            patientName={treatmentName}
            patientEmail={treatmentEmail}
            onClose={() => {
              setTreatmentUid(null);
              setTreatmentName(null);
              setTreatmentEmail(null);
            }}
          />
        )}
      </div>
    </Card>
  );
}
