"use server";

import { getUserRoleFromToken, verifyStaffToken } from "@/lib/services/admin-service";
import {
  getAppointmentsByPatientIdAdmin,
  updateTreatmentExtrasAdmin,
} from "@/lib/services/appointment-service-admin";

type DentalChartEntry = {
  status?: string;
  notes?: string;
  updatedAt?: number;
  updatedBy?: string;
};

function toMillis(value: any) {
  if (!value) return 0;
  if (typeof value?.toDate === "function") return value.toDate().getTime();
  if (typeof value?.seconds === "number") return value.seconds * 1000;
  const d = new Date(value);
  const ms = d.getTime();
  return Number.isNaN(ms) ? 0 : ms;
}

function pickLatestDentalChart(appointments: any[]) {
  const candidates = appointments
    .filter((a) => (a as any)?.treatment?.dentalChart)
    .map((a) => {
      const treatment = (a as any).treatment || {};
      const chart = treatment.dentalChart || {};
      const imageUrls = Array.isArray(treatment.imageUrls)
        ? treatment.imageUrls
        : [];
      const completedAt = treatment.completedAt;
      const date = (a as any).date;
      const time = (a as any).time;
      const score =
        toMillis(completedAt) ||
        toMillis(date && time ? `${date}T${time}:00` : date) ||
        0;
      return {
        chart,
        imageUrls,
        score,
        completedAt,
        date,
        time,
        appointmentId: (a as any).id,
      };
    })
    .filter((c) => Object.keys(c.chart || {}).length > 0);

  if (!candidates.length) return null;
  candidates.sort((a, b) => b.score - a.score);
  return candidates[0];
}

function pickLatestAppointmentMeta(appointments: any[]) {
  const candidates = appointments.map((a) => {
    const treatment = (a as any).treatment || {};
    const completedAt = treatment.completedAt;
    const date = (a as any).date;
    const time = (a as any).time;
    const score =
      toMillis(completedAt) ||
      toMillis(date && time ? `${date}T${time}:00` : date) ||
      0;
    return {
      appointmentId: (a as any).id,
      completedAt,
      date,
      time,
      score,
    };
  });

  if (!candidates.length) return null;
  candidates.sort((a, b) => b.score - a.score);
  return candidates[0];
}

function pickAttachmentGroups(appointments: any[]) {
  const groups = appointments
    .filter((a) => Array.isArray((a as any)?.treatment?.imageUrls))
    .map((a) => {
      const treatment = (a as any).treatment || {};
      const imageUrls = Array.isArray(treatment.imageUrls) ? treatment.imageUrls : [];
      const completedAt = treatment.completedAt;
      const date = (a as any).date;
      const time = (a as any).time;
      const score =
        toMillis(completedAt) ||
        toMillis(date && time ? `${date}T${time}:00` : date) ||
        0;
      return {
        appointmentId: (a as any).id,
        date,
        time,
        completedAt,
        imageUrls,
        notes: treatment.notes || "",
        procedures: Array.isArray(treatment.procedures)
          ? treatment.procedures.map((p: any) => ({
              name: p?.name || "",
              toothNumber: p?.toothNumber || "",
            }))
          : [],
        score,
      };
    })
    .filter((g) => g.imageUrls.length > 0);

  groups.sort((a, b) => b.score - a.score);
  return groups;
}

export async function getPatientDentalChartAction(input: {
  patientId: string;
  idToken: string;
}): Promise<{
  success: boolean;
  data?: {
    chart: Record<string, DentalChartEntry>;
    imageUrls?: string[];
    meta: { date?: string; time?: string; completedAt?: any; appointmentId?: string } | null;
  };
  error?: string;
}> {
  if (!input?.patientId || !input?.idToken) {
    return { success: false, error: "Missing required fields" };
  }

  const ok = await verifyStaffToken(input.idToken);
  if (!ok) return { success: false, error: "Unauthorized" };

  const res = await getAppointmentsByPatientIdAdmin(input.patientId);
  if (!res.success || !res.data) {
    return { success: false, error: res.error || "Failed to load appointments" };
  }

  const latest = pickLatestDentalChart(res.data);
  const latestMeta = pickLatestAppointmentMeta(res.data);
  if (!latest) {
    return {
      success: true,
      data: {
        chart: {},
        imageUrls: [],
        meta: latestMeta
          ? {
              date: latestMeta.date,
              time: latestMeta.time,
              completedAt: latestMeta.completedAt,
              appointmentId: latestMeta.appointmentId,
            }
          : null,
      },
    };
  }

  return {
    success: true,
    data: {
      chart: latest.chart || {},
      imageUrls: latest.imageUrls || [],
      meta: {
        date: latest.date,
        time: latest.time,
        completedAt: latest.completedAt,
        appointmentId: latest.appointmentId,
      },
    },
  };
}

export async function getPatientAttachmentsAction(input: {
  patientId: string;
  idToken: string;
}): Promise<{
  success: boolean;
  data?: {
    groups: Array<{
      appointmentId: string;
      date?: string;
      time?: string;
      completedAt?: any;
      imageUrls: string[];
      notes?: string;
      procedures?: Array<{ name?: string; toothNumber?: string }>;
    }>;
  };
  error?: string;
}> {
  if (!input?.patientId || !input?.idToken) {
    return { success: false, error: "Missing required fields" };
  }

  const ok = await verifyStaffToken(input.idToken);
  if (!ok) return { success: false, error: "Unauthorized" };

  const res = await getAppointmentsByPatientIdAdmin(input.patientId);
  if (!res.success || !res.data) {
    return { success: false, error: res.error || "Failed to load appointments" };
  }

  const groups = pickAttachmentGroups(res.data).map((g) => ({
    appointmentId: g.appointmentId,
    date: g.date,
    time: g.time,
    completedAt: g.completedAt,
    imageUrls: g.imageUrls,
    notes: g.notes || undefined,
    procedures: g.procedures || [],
  }));

  return {
    success: true,
    data: { groups },
  };
}

export async function updatePatientDentalChartAction(input: {
  appointmentId: string;
  idToken: string;
  dentalChartPatch: Record<string, DentalChartEntry>;
}): Promise<{ success: boolean; error?: string }> {
  if (!input?.appointmentId || !input?.idToken) {
    return { success: false, error: "Missing required fields" };
  }

  const role = await getUserRoleFromToken(input.idToken);
  if (role !== "dentist") {
    return { success: false, error: "Unauthorized" };
  }

  return await updateTreatmentExtrasAdmin(input.appointmentId, {
    dentalChartPatch: input.dentalChartPatch,
  });
}
