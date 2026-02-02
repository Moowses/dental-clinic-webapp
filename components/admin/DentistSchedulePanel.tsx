"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";

import { getDentistScheduleAction } from "@/app/actions/appointment-actions";
import {
  getTreatmentToolsAction,
  completeTreatmentAction,
} from "@/app/actions/treatment-actions";

import { Odontogram } from "react-odontogram";

import type { Appointment } from "@/lib/types/appointment";
import type { DentalProcedure } from "@/lib/types/clinic";
import type { InventoryItem } from "@/lib/types/inventory";

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

const inputBase =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-300";

function StatusPill({ status }: { status: string }) {
  const s = (status || "").toLowerCase();
  const cls =
    s === "pending"
      ? "bg-orange-50 text-orange-700 border-orange-200"
      : s === "confirmed"
        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
        : s === "completed"
          ? "bg-blue-50 text-blue-700 border-blue-200"
          : s === "cancelled"
            ? "bg-red-50 text-red-700 border-red-200"
            : "bg-slate-50 text-slate-700 border-slate-200";

  return (
    <span
      className={`inline-flex items-center px-3 py-1 rounded-full border text-[11px] font-extrabold uppercase tracking-wide ${cls}`}
    >
      {status}
    </span>
  );
}

function toISODate(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.toISOString().split("T")[0];
}

function addDays(isoDate: string, days: number) {
  const d = new Date(isoDate + "T00:00:00");
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

function formatNiceDate(isoDate: string) {
  const d = new Date(isoDate + "T00:00:00");
  if (Number.isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
}

function formatRangeLabel(startISO: string, days: number) {
  const start = new Date(startISO + "T00:00:00");
  const end = new Date(startISO + "T00:00:00");
  end.setDate(end.getDate() + (days - 1));

  const startLabel = start.toLocaleDateString(undefined, {
    month: "short",
    day: "2-digit",
  });
  const endLabel = end.toLocaleDateString(undefined, {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });

  return `${startLabel} – ${endLabel}`;
}

function parseTimeToSortable(time?: string) {
  if (!time) return "99:99";
  const t = time.trim().toUpperCase();

  const hhmm = t.match(/^(\d{1,2}):(\d{2})$/);
  if (hhmm) {
    const h = String(hhmm[1]).padStart(2, "0");
    const m = String(hhmm[2]).padStart(2, "0");
    return `${h}:${m}`;
  }

  const ampm = t.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/);
  if (ampm) {
    let h = parseInt(ampm[1], 10);
    const m = String(ampm[2]).padStart(2, "0");
    const ap = ampm[3];
    if (ap === "AM") {
      if (h === 12) h = 0;
    } else {
      if (h !== 12) h += 12;
    }
    return `${String(h).padStart(2, "0")}:${m}`;
  }

  return "99:99";
}

function universalToFdi(universal: number) {
  if (universal >= 1 && universal <= 8) return 19 - universal;
  if (universal >= 9 && universal <= 16) return universal + 12;
  if (universal >= 17 && universal <= 24) return 55 - universal;
  if (universal >= 25 && universal <= 32) return universal + 16;
  return null;
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

function toothToUniversal(tooth: any) {
  return (
    tooth?.notations?.universal ||
    tooth?.notations?.fdi ||
    String(tooth?.id || "").replace("teeth-", "")
  );
}

function payloadToUniversal(payload: any) {
  const raw = payload?.notations?.universal || payload?.notations?.fdi || "";
  if (!raw) return "";
  const num = Number(raw);
  if (Number.isFinite(num)) return String(num);
  return String(raw);
}

function DentalChartModal({
  open,
  chart,
  onClose,
  onSave,
}: {
  open: boolean;
  chart: Record<string, { status?: string; notes?: string }>;
  onClose: () => void;
  onSave: (chart: Record<string, { status?: string; notes?: string }>) => void;
}) {
  const [draft, setDraft] = useState<Record<string, { status?: string; notes?: string }>>({});
  const [toothNumber, setToothNumber] = useState("");
  const [status, setStatus] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedTeeth, setSelectedTeeth] = useState<any[]>([]);
  const pendingRef = React.useRef<number | null>(null);

  useEffect(() => {
    if (!open) return;
    setDraft(chart || {});
    setToothNumber("");
    setStatus("");
    setNotes("");
    setSelectedTeeth([]);
  }, [open, chart]);

  if (!open) return null;

  const rows = Object.entries(draft);
  const initialSelected = rows
    .map(([key]) => keyToToothId(key))
    .filter(Boolean) as string[];

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-3xl rounded-2xl bg-white shadow-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200">
          <h3 className="text-lg font-extrabold text-slate-900">Dental Chart</h3>
          <p className="text-xs text-slate-500 mt-0.5">Add or update tooth notes</p>
        </div>

        <div className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-[140px_160px_1fr] gap-3">
            <input
              value={toothNumber}
              onChange={(e) => setToothNumber(e.target.value)}
              className={inputBase}
              placeholder="Tooth #"
            />
            <input
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className={inputBase}
              placeholder="Status (e.g. caries)"
            />
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className={inputBase}
              placeholder="Notes"
            />
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-extrabold uppercase tracking-widest text-slate-600">
              Adult Chart (1-32)
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Click a tooth to load its notes below, then use Add/Update and Save. Finalize Treatment to store in records.
            </p>
              <div className="mt-3">
                <Odontogram
                  key={initialSelected.join(",")}
                  defaultSelected={initialSelected}
                  theme="light"
                  colors={{}}
                  tooltip={{
                    content: (payload: any) => {
                      const key = payloadToUniversal(payload);
                    const entry = key ? draft[key] : null;
                    return (
                      <div>
                        <div>Tooth: {key || "—"}</div>
                        <div>Status: {entry?.status || "—"}</div>
                        <div>Notes: {entry?.notes || "—"}</div>
                      </div>
                    );
                  },
                }}
                onChange={(next: any) => {
                  if (!next || typeof next !== "object") return;
                  const list = Array.isArray(next) ? next : [];
                  if (!list.length) return;
                  const picked = list[list.length - 1];
                  const key = String(toothToUniversal(picked) || "").trim();
                  if (!key) return;
                  if (pendingRef.current) {
                    window.clearTimeout(pendingRef.current);
                  }
                  pendingRef.current = window.setTimeout(() => {
                    setToothNumber(key);
                    setStatus(draft[key]?.status || "");
                    setNotes(draft[key]?.notes || "");
                    setSelectedTeeth(list);
                  }, 0);
                }}
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const key = toothNumber.trim();
                if (!key) return;
                const next = {
                  ...draft,
                  [key]: {
                    status: status.trim() || undefined,
                    notes: notes.trim() || undefined,
                  },
                };
                setDraft(next);
                setToothNumber("");
                setStatus("");
                setNotes("");
              }}
              className="px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-extrabold hover:bg-black"
            >
              Add / Update
            </button>
            <button
              onClick={() => {
                setToothNumber("");
                setStatus("");
                setNotes("");
              }}
              className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-extrabold hover:bg-slate-50"
            >
              Clear
            </button>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-extrabold uppercase tracking-widest text-slate-600">
              Entries
            </p>
            {rows.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">No dental chart entries yet.</p>
            ) : (
              <div className="mt-3 space-y-2">
                {rows.map(([tooth, entry]) => (
                  <div
                    key={tooth}
                    className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-extrabold text-slate-900">Tooth {tooth}</p>
                      <p className="text-xs text-slate-600">
                        {entry.status || "No status"}{" "}
                        {entry.notes ? `- ${entry.notes}` : ""}
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        const next = { ...draft };
                        delete next[tooth];
                        setDraft(next);
                      }}
                      className="text-xs font-extrabold text-rose-600 hover:text-rose-700"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <button
              onClick={() => {
                onSave(draft);
                onClose();
              }}
              className="w-full rounded-xl bg-emerald-700 py-3 text-white font-black hover:bg-emerald-800 transition"
            >
              Save Dental Chart
            </button>
            <button
              onClick={onClose}
              className="w-full text-center text-sm text-slate-500 hover:text-slate-700"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function TreatmentModal({
  appointment,
  onClose,
  onComplete,
}: {
  appointment: Appointment;
  onClose: () => void;
  onComplete: () => void;
}) {
  const [tools, setTools] = useState<{
    procedures: (DentalProcedure & {
      requiredInventory?: { inventoryItemId: string; quantity: number }[];
    })[];
    inventory: InventoryItem[];
  } | null>(null);

  const [procList, setProcList] = useState<
    {
      id: string;
      name: string;
      price: number;
      toothNumber: string;
      isCustom: boolean;
    }[]
  >([]);

  const [usedInv, setUsedInv] = useState<{ [id: string]: number }>({});
  const [notes, setNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [chartOpen, setChartOpen] = useState(false);
  const [dentalChart, setDentalChart] = useState<
    Record<string, { status?: string; notes?: string }>
  >({});
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    getTreatmentToolsAction().then((res) => {
      if (res.success && res.data) setTools(res.data as any);
    });
  }, []);

  const addProcedure = (p: any) => {
    setProcList([
      ...procList,
      {
        id: p.id,
        name: p.name,
        price: p.basePrice,
        toothNumber: "",
        isCustom: false,
      },
    ]);

    if (p.requiredInventory && p.requiredInventory.length > 0) {
      const newUsedInv = { ...usedInv };
      p.requiredInventory.forEach((item: any) => {
        newUsedInv[item.inventoryItemId] =
          (newUsedInv[item.inventoryItemId] || 0) + item.quantity;
      });
      setUsedInv(newUsedInv);
    }
  };

  const addCustomProcedure = () => {
    setProcList([
      ...procList,
      {
        id: crypto.randomUUID(),
        name: "Custom Procedure",
        price: 0,
        toothNumber: "",
        isCustom: true,
      },
    ]);
  };

  const removeProcedure = (index: number) => {
    setProcList(procList.filter((_, i) => i !== index));
  };

  const updateProcedure = (
    index: number,
    field: "name" | "price" | "toothNumber",
    value: any,
  ) => {
    const newList = [...procList];
    newList[index] = { ...newList[index], [field]: value };
    setProcList(newList);
  };

  const estimatedTotal = useMemo(() => {
    return procList.reduce((sum, p) => sum + Number(p.price || 0), 0);
  }, [procList]);

  const inventorySummary = useMemo(() => {
    return (
      tools?.inventory
        .filter((i) => usedInv[i.id] > 0)
        .map((i) => ({ id: i.id, name: i.name, quantity: usedInv[i.id] })) || []
    );
  }, [tools, usedInv]);

  const dentalChartCount = useMemo(() => {
    return Object.keys(dentalChart || {}).length;
  }, [dentalChart]);

  const handleSave = async () => {
    setIsSaving(true);
    const res = await completeTreatmentAction(appointment.id, {
      notes,
      dentalChart: Object.keys(dentalChart).length ? dentalChart : undefined,
      imageUrls: imageUrls.length ? imageUrls : undefined,
      procedures: procList.map((p) => ({
        id: p.id,
        name: p.name,
        price: Number(p.price),
        toothNumber: p.toothNumber,
        })),
        inventoryUsed: inventorySummary,
      });

    if (res.success) {
      onComplete();
      onClose();
    } else {
      alert(res.error);
    }
    setIsSaving(false);
  };

  const uploadImages = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
    const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;
    if (!cloudName || !uploadPreset) {
      setUploadError("Cloudinary env vars missing.");
      return;
    }

    setUploading(true);
    setUploadError(null);
    setUploadProgress(0);
    const nextUrls: string[] = [];

    const fileList = Array.from(files);
    const uploadSingle = (file: File, index: number, total: number) =>
      new Promise<string | null>((resolve, reject) => {
        const form = new FormData();
        form.append("file", file);
        form.append("upload_preset", uploadPreset);

        const xhr = new XMLHttpRequest();
        xhr.open("POST", `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`);
        xhr.upload.onprogress = (evt) => {
          if (!evt.lengthComputable) return;
          const overall = (index + evt.loaded / evt.total) / total;
          setUploadProgress(Math.round(overall * 100));
        };
        xhr.onload = () => {
          try {
            const data = JSON.parse(xhr.responseText || "{}");
            if (xhr.status >= 200 && xhr.status < 300 && data?.secure_url) {
              resolve(String(data.secure_url));
              return;
            }
            reject(new Error(data?.error?.message || "Upload failed"));
          } catch {
            reject(new Error("Upload failed"));
          }
        };
        xhr.onerror = () => reject(new Error("Upload failed"));
        xhr.send(form);
      });

    for (let i = 0; i < fileList.length; i += 1) {
      const file = fileList[i];
      try {
        const url = await uploadSingle(file, i, fileList.length);
        if (url) nextUrls.push(url);
      } catch (err: any) {
        setUploadError(err?.message || "Failed to upload image.");
      }
    }

    if (nextUrls.length) {
      setImageUrls((prev) => [...prev, ...nextUrls]);
    }
    setUploading(false);
    setUploadProgress(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-5xl rounded-2xl bg-white shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200">
          <h3 className="text-lg font-extrabold text-slate-900">
            Record Treatment — {appointment.serviceType}
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">Dentist tools</p>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          {/* Notes top */}
          <textarea
            placeholder="Clinical Notes..."
            className="w-full rounded-xl border border-slate-200 bg-white p-4 h-28 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/15"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />

          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-extrabold text-slate-900">Dental Chart</p>
                <p className="text-xs text-slate-500">
                  Entries: {Object.keys(dentalChart).length}
                </p>
              </div>
              <button
                onClick={() => setChartOpen(true)}
                className="text-xs font-extrabold text-black px-3 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50"
              >
                Open Dental Chart
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-extrabold text-slate-900">Attachments</p>
                <p className="text-xs text-slate-500">
                  Add photos for this appointment (multiple allowed).
                </p>
              </div>
              <label className="text-xs font-extrabold text-black px-3 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 cursor-pointer">
                {uploading ? "Uploading..." : "Upload Images"}
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => uploadImages(e.target.files)}
                  disabled={uploading}
                />
              </label>
            </div>

            {uploadError ? (
              <p className="mt-2 text-xs font-extrabold text-rose-600">{uploadError}</p>
            ) : null}

            {uploading && (
              <div className="mt-3">
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
                  <div
                    className="h-full bg-slate-900 transition-all"
                    style={{ width: `${uploadProgress ?? 0}%` }}
                  />
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {uploadProgress ?? 0}%
                </p>
              </div>
            )}

            {imageUrls.length > 0 ? (
              <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-3">
                {imageUrls.map((url, idx) => (
                  <div key={`${url}_${idx}`} className="relative group">
                    <img
                      src={url}
                      alt={`Attachment ${idx + 1}`}
                      className="h-28 w-full object-cover rounded-xl border border-slate-200"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setImageUrls((prev) => prev.filter((_, i) => i !== idx))
                      }
                      className="absolute top-2 right-2 rounded-full bg-white/90 border border-slate-200 text-slate-700 text-xs px-2 py-1 opacity-0 group-hover:opacity-100 transition"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-xs text-slate-500">No images uploaded yet.</p>
            )}
          </div>

          {/* Two panels */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* LEFT: Procedures */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm font-extrabold text-slate-900">Procedures</p>

                {/* Keep functionality: add from catalog + custom */}
                <div className="flex items-center gap-2">
                  <select
                    className="text-xs px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/15"
                    onChange={(e) => {
                      const p = tools?.procedures.find(
                        (proc) => proc.id === e.target.value,
                      );
                      if (p) addProcedure(p);
                      e.target.value = "";
                    }}
                  >
                    <option value="">+ Add from Catalog</option>
                    {tools?.procedures.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} (Php{p.basePrice})
                      </option>
                    ))}
                  </select>

                  <button
                    onClick={addCustomProcedure}
                    className="text-xs font-extrabold text-black px-3 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50"
                  >
                    + Custom
                  </button>

                </div>
              </div>

              <div className="mt-3 space-y-2 max-h-[360px] overflow-y-auto pr-1">
                {procList.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-center">
                    <p className="text-sm text-slate-500">No procedures added yet.</p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Add from catalog or create a custom procedure
                    </p>
                  </div>
                ) : (
                  procList.map((p, idx) => (
                    <div
                      key={p.id}
                      className="rounded-xl border border-slate-200 bg-white p-3 hover:bg-slate-50 transition"
                    >
                      {/* Top row: checkbox look + name + row price + remove */}
                      <div className="flex items-start gap-3">
                        <div className="pt-1">
                          <div className="h-4 w-4 rounded border border-slate-300 bg-white" />
                        </div>

                        <div className="min-w-0 flex-1">
                          <input
                            value={p.name}
                            onChange={(e) =>
                              updateProcedure(idx, "name", e.target.value)
                            }
                            className="w-full bg-transparent text-sm font-extrabold text-slate-900 focus:outline-none"
                            placeholder="Procedure name"
                          />

                          {/* Inputs row: tooth # and price */}
                          <div className="mt-2 flex flex-wrap gap-2">
                            <input
                              value={p.toothNumber}
                              onChange={(e) =>
                                updateProcedure(idx, "toothNumber", e.target.value)
                              }
                              className="w-full sm:w-[200px] rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/15"
                              placeholder="Tooth # (e.g. 14, UL)"
                            />

                            <input
                              type="number"
                              value={p.price}
                              onChange={(e) =>
                                updateProcedure(idx, "price", e.target.value)
                              }
                              className="w-full sm:w-[140px] rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 text-right font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/15"
                              placeholder="0"
                            />
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-sm font-extrabold text-slate-900">
                            Php{Number(p.price || 0).toLocaleString()}
                          </span>
                          <button
                            onClick={() => removeProcedure(idx)}
                            className="h-8 w-8 rounded-full border border-slate-200 bg-white text-slate-400 hover:text-red-600 hover:border-red-200 hover:bg-red-50 transition"
                            aria-label="Remove procedure"
                            title="Remove"
                          >
                            ×
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Total */}
              <div className="mt-4 flex items-center justify-between rounded-xl bg-slate-50 border border-slate-200 px-4 py-3">
                <span className="text-xs font-extrabold uppercase tracking-wide text-slate-600">
                  Estimated Total
                </span>
                <span className="text-lg font-black text-slate-900 font-mono">
                  Php{estimatedTotal.toLocaleString()}
                </span>
              </div>
            </div>

            {/* RIGHT: Inventory Used */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-sm font-extrabold text-slate-900">Inventory Used</p>

              <div className="mt-3 space-y-2 max-h-[420px] overflow-y-auto pr-1">
                {tools?.inventory
                  .filter((i) => i.category === "consumable")
                  .map((i) => (
                    <div
                      key={i.id}
                      className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3 hover:bg-slate-50 transition"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-extrabold text-slate-900 truncate">
                          {i.name}
                        </p>
                        <p className="text-xs text-slate-500">
                          Current stock: {i.stock}
                        </p>
                      </div>

                      <div className="flex items-center gap-3">
                        <button
                          onClick={() =>
                            setUsedInv({
                              ...usedInv,
                              [i.id]: Math.max(0, (usedInv[i.id] || 0) - 1),
                            })
                          }
                          className="h-8 w-10 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-extrabold"
                        >
                          -
                        </button>

                        <span className="w-6 text-center text-sm font-black text-slate-900">
                          {usedInv[i.id] || 0}
                        </span>

                        <button
                          onClick={() =>
                            setUsedInv({
                              ...usedInv,
                              [i.id]: (usedInv[i.id] || 0) + 1,
                            })
                          }
                          className="h-8 w-10 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-extrabold"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>

            {/* Bottom actions like old UI */}
            <button
              onClick={() => setConfirmOpen(true)}
              disabled={isSaving || procList.length === 0}
              className="w-full rounded-xl bg-emerald-700 py-3 text-white font-black hover:bg-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {isSaving ? "Finalizing Treatment..." : "Finalize Treatment"}
            </button>

          <button
            onClick={onClose}
            className="w-full text-center text-sm text-slate-500 hover:text-slate-700"
          >
            Cancel
          </button>
        </div>
      </div>
        <DentalChartModal
          open={chartOpen}
          chart={dentalChart}
          onClose={() => setChartOpen(false)}
          onSave={(next) => setDentalChart(next)}
        />
        {confirmOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
            <div className="w-full max-w-xl rounded-2xl bg-white shadow-2xl overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200">
                <h3 className="text-lg font-extrabold text-slate-900">Finalize Treatment</h3>
                <p className="text-sm text-slate-500">
                  Review the summary before saving.
                </p>
              </div>
              <div className="p-6 space-y-4">
                <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                  <p className="text-xs font-extrabold uppercase tracking-widest text-slate-600">
                    Summary
                  </p>
                  <div className="mt-2 text-sm text-slate-700 space-y-1">
                    <p>Procedures: {procList.length}</p>
                    <p>Inventory used: {inventorySummary.length}</p>
                    <p>Dental chart entries: {dentalChartCount}</p>
                    <p>Attachments: {imageUrls.length}</p>
                    <p>Total bill: ₱{estimatedTotal.toFixed(2)}</p>
                  </div>
                </div>

                {procList.length > 0 && (
                  <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                    <p className="text-xs font-extrabold uppercase tracking-widest text-slate-600">
                      Procedures
                    </p>
                    <div className="mt-2 space-y-1 text-sm text-slate-700">
                      {procList.map((p, idx) => (
                        <p key={`${p.id || "proc"}_${idx}`}>
                          {p.name || "Unnamed"}{" "}
                          {p.toothNumber ? `(tooth ${p.toothNumber})` : ""} - ₱
                          {Number(p.price || 0).toFixed(2)}
                        </p>
                      ))}
                    </div>
                  </div>
                )}

                {inventorySummary.length > 0 && (
                  <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                    <p className="text-xs font-extrabold uppercase tracking-widest text-slate-600">
                      Inventory Used
                    </p>
                    <div className="mt-2 space-y-1 text-sm text-slate-700">
                      {inventorySummary.map((i) => (
                        <p key={i.id}>
                          {i.name} - {i.quantity}
                        </p>
                      ))}
                    </div>
                  </div>
                )}

                {dentalChartCount === 0 && (
                  <p className="text-sm text-slate-500">
                    Dental chart is empty for this treatment.
                  </p>
                )}

                {imageUrls.length === 0 && (
                  <p className="text-sm text-slate-500">
                    No attachments added for this treatment.
                  </p>
                )}
              </div>
              <div className="px-6 py-4 border-t border-slate-200 flex flex-col gap-2">
                <button
                  onClick={async () => {
                    setConfirmOpen(false);
                    await handleSave();
                  }}
                  disabled={isSaving}
                  className="w-full rounded-xl bg-emerald-700 py-3 text-white font-black hover:bg-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  {isSaving ? "Finalizing Treatment..." : "Confirm & Save"}
                </button>
                <button
                  onClick={() => setConfirmOpen(false)}
                  className="w-full text-center text-sm text-slate-500 hover:text-slate-700"
                >
                  Back
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

export default function DentistSchedulePanel() {
  const todayISO = useMemo(() => toISODate(new Date()), []);
  const [startDate, setStartDate] = useState(todayISO);

  const [rangeDays, setRangeDays] = useState<7 | 30>(7);

  const [schedule, setSchedule] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);

  const [activeTreatment, setActiveTreatment] = useState<Appointment | null>(null);

  const datesToFetch = useMemo(() => {
    const list: string[] = [];
    for (let i = 0; i < rangeDays; i++) list.push(addDays(startDate, i));
    return list;
  }, [startDate, rangeDays]);

  const refresh = useCallback(async () => {
    setLoading(true);

    const results = await Promise.all(
      datesToFetch.map(async (d) => {
        const res = await getDentistScheduleAction(d);
        if (res?.success && res.data) {
          const rows = ((res.data as Appointment[]) || []).map((a) => ({
            ...a,
            date: (a as any).date || d,
          }));
          return rows;
        }
        return [];
      }),
    );

    const merged = results.flat();

    merged.sort((a, b) => {
      const da = String((a as any).date || "");
      const db = String((b as any).date || "");
      if (da !== db) return da.localeCompare(db);

      const ta = parseTimeToSortable((a as any).time);
      const tb = parseTimeToSortable((b as any).time);
      return ta.localeCompare(tb);
    });

    setSchedule(merged);
    setLoading(false);
  }, [datesToFetch]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const subtitle = useMemo(() => {
    const label = formatRangeLabel(startDate, rangeDays);
    return `Showing: ${label}`;
  }, [startDate, rangeDays]);

  return (
    <Card title="Upcoming Patient Schedule" subtitle={subtitle}>
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
          <div className="flex items-center gap-3">
            <label className="text-xs font-extrabold text-slate-600 uppercase tracking-widest">
              Start
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className={`${inputBase} max-w-[180px]`}
            />
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs font-extrabold text-slate-600 uppercase tracking-widest">
              Range
            </label>
            <select
              value={rangeDays}
              onChange={(e) =>
                setRangeDays((e.target.value === "30" ? 30 : 7) as 7 | 30)
              }
              className={`${inputBase} max-w-[220px]`}
            >
              <option value={7}>Next 7 days</option>
              <option value={30}>Next 30 days</option>
            </select>
          </div>
        </div>

        <button
          onClick={refresh}
          className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-sm font-extrabold hover:bg-slate-50"
        >
          Refresh
        </button>
      </div>

      <div className="mt-4">
        {loading ? (
          <p className="text-sm text-slate-500">Loading schedule...</p>
        ) : schedule.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <p className="text-sm font-extrabold text-slate-900">
              No upcoming appointments
            </p>
            <p className="mt-1 text-xs text-slate-500">
              No assigned appointments for the selected range.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {schedule.map((app) => {
              const patientLabel =
                (app as any).patientName ||
                (app as any).patientFullName ||
                (app as any).patientEmail ||
                (app as any).patientId ||
                "Patient";

              const dateLabel = formatNiceDate(String((app as any).date || ""));

              return (
                <div
                  key={app.id}
                  className="border border-slate-200 rounded-2xl p-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between"
                >
                  <div className="min-w-0">
                    <p className="text-base font-extrabold text-slate-900">
                      {(app as any).time} — {(app as any).serviceType}
                    </p>

                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <StatusPill status={(app as any).status} />
                      <span className="text-xs text-slate-500">{dateLabel}</span>
                    </div>

                    <p className="mt-2 text-sm text-slate-700">
                      <span className="font-bold text-slate-900">Patient:</span>{" "}
                      {patientLabel}
                    </p>
                  </div>

                  {(app as any).status !== "completed" ? (
                    <button
                      onClick={() => setActiveTreatment(app)}
                      className="px-4 py-2 rounded-xl bg-teal-700 text-white font-extrabold text-sm hover:bg-teal-800"
                    >
                      Treat
                    </button>
                  ) : (
                    <span className="text-xs font-extrabold text-slate-500">
                      Completed
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {activeTreatment && (
        <TreatmentModal
          appointment={activeTreatment}
          onClose={() => setActiveTreatment(null)}
          onComplete={refresh}
        />
      )}
    </Card>
  );
}
