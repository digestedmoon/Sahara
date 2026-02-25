import apiClient from './axios';

export interface Reminder {
    id: number;
    elder_id: number;
    memory_id?: number;
    title: string;
    body?: string;
    scheduled_time: string;
    repeat_pattern: string;
    active: boolean;
    created_at: string;
}

export const listReminders = (elderId: number, activeOnly = false) =>
    apiClient.get<{ reminders: Reminder[] }>(`/reminders/${elderId}`, {
        params: activeOnly ? { active: 'true' } : {},
    }).then((r) => r.data.reminders);

export const createReminder = (payload: {
    elder_id: number;
    title: string;
    body?: string;
    scheduled_time: string;
    repeat_pattern?: string;
    memory_id?: number;
}) => apiClient.post<{ reminder: Reminder }>('/reminders', payload).then((r) => r.data.reminder);

export const updateReminder = (id: number, payload: Partial<Reminder>) =>
    apiClient.put<{ reminder: Reminder }>(`/reminders/${id}`, payload).then((r) => r.data.reminder);

export const deleteReminder = (id: number) =>
    apiClient.delete(`/reminders/${id}`).then((r) => r.data);

export const reminderAction = (id: number, action: 'taken' | 'later' | 'missed') =>
    apiClient.post(`/reminders/${id}/action`, { action }).then((r) => r.data);

export const getReminderCompliance = (elderId: number) =>
    apiClient.get(`/reminders/${elderId}/compliance`).then((r) => r.data);
