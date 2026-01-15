import { getAppointmentByIdAdmin } from "@/lib/services/appointment-service-admin";
import ConfirmationClient from "./confirmation-client";
import { notFound } from "next/navigation";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ConfirmPage({ params }: PageProps) {
  const { id } = await params;
  // Use the ADMIN version to bypass security rules on the server
  const result = await getAppointmentByIdAdmin(id);

  if (!result.success || !result.data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center p-8">
          <h1 className="text-2xl font-bold text-red-600 mb-2">Link Expired or Invalid</h1>
          <p className="text-gray-600">We could not find the appointment you are looking for.</p>
        </div>
      </div>
    );
  }

  const appointment = result.data;

  if (appointment.status === "cancelled") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center p-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Appointment Cancelled</h1>
          <p className="text-gray-600">This appointment has been cancelled.</p>
        </div>
      </div>
    );
  }

  // If already confirmed, we can still show the success state or just the confirmation card again
  // but showing a "Already Confirmed" message is nicer.
  if (appointment.status === "confirmed" || appointment.status === "completed") {
     return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center p-8 bg-green-50 rounded-lg border border-green-200">
          <h2 className="text-2xl font-bold text-green-700 mb-2">Already Confirmed</h2>
          <p className="text-green-600">
            This appointment is already confirmed for {appointment.date} at {appointment.time}.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <ConfirmationClient 
        id={appointment.id} 
        service={appointment.serviceType} 
        date={appointment.date} 
        time={appointment.time} 
      />
    </div>
  );
}
