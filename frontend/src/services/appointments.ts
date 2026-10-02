import api from "./api";

export interface Appointment {
    id: number;
    customer: number;
    customer_username: string;
    booking_reference: string;
    scheduled_at: string | null;
    duration_minutes: number;
    status: "PENDING" | "CONFIRMED" | "COMPLETED" | "CANCELLED";
    reason: string;
    notes: string;
    calendly_event_uri: string;
    calendly_invitee_uri: string;
    meeting_url: string;
    created_at: string;
    updated_at: string;
}

export interface CreateAppointmentData {
    reason: string;
    notes: string;
}

export const getMyAppointments = async (): Promise<Appointment[]> => {
    const response = await api.get<Appointment[]>(
        "appointments/my/",
    );

    return response.data;
};

export const createAppointment = async (
    data: CreateAppointmentData,
): Promise<Appointment> => {
    const response = await api.post<Appointment>(
        "appointments/my/",
        data,
    );

    return response.data;
};
export const getDieticianAppointments = async (): Promise<
    Appointment[]
> => {
    const response = await api.get("appointments/manage/");

    return response.data.results ?? response.data;
};

export interface ConfirmAppointmentData {
    event_uri: string;
    invitee_uri?: string;
}

/**
 * Tell the backend which Calendly slot was picked.
 *
 * Calendly's webhook cannot reach a local machine, and even in production
 * it arrives a moment later. The widget tells the browser straight away,
 * so this makes the appointment show its real time immediately.
 */
export const confirmAppointment = async (
    appointmentId: number,
    data: ConfirmAppointmentData,
): Promise<Appointment> => {
    const response = await api.post<Appointment>(
        `appointments/my/${appointmentId}/confirm/`,
        data,
    );

    return response.data;
};

/**
 * Cancel in Calendly as well as here.
 *
 * Marking it cancelled only on the website leaves the slot booked in
 * Calendly, and the next sync puts it back to confirmed.
 */
export const cancelAppointment = async (
    appointmentId: number,
    reason = "",
): Promise<Appointment> => {
    const response = await api.post<Appointment>(
        `appointments/manage/${appointmentId}/cancel/`,
        { reason },
    );

    return response.data;
};

export const updateAppointmentStatus = async (
    appointmentId: number,
    status: Appointment["status"],
): Promise<Appointment> => {
    const response = await api.patch<Appointment>(
        `appointments/manage/${appointmentId}/`,
        { status },
    );

    return response.data;
};
