import apiClient from './axios';

export interface ElderSummary {
    id: number;
    name: string;
    email: string;
    language: string;
    memories: number;
    reminders: number;
    last_active?: string;
}

export interface DashboardData {
    stats: {
        elder_count: number;
        memory_count: number;
        reminder_count: number;
        emergency_count: number;
        compliance_pct: number;
    };
    elders: ElderSummary[];
    activity: Array<{
        type: string;
        elder_id: number;
        text: string;
        intent?: string;
        timestamp: string;
    }>;
}

export const getDashboard = () => apiClient.get<DashboardData>('/caregiver/dashboard').then((r) => r.data);
export const listElders = () => apiClient.get<{ elders: ElderSummary[] }>('/caregiver/elders').then((r) => r.data.elders);
export const getQueryLogs = (elderId: number) => apiClient.get(`/query/logs/${elderId}`).then((r) => r.data);
