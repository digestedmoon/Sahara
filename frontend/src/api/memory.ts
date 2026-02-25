import apiClient from './axios';

export interface Memory {
  id: number;
  elder_id: number;
  type: 'person' | 'medicine' | 'routine' | 'event' | 'object' | 'reassurance';
  title: string;
  description?: string;
  source: string;
  valid_from?: string;
  valid_to?: string;
  created_at: string;
  updated_at: string;
  detail: Record<string, any>;
}

export const listMemories = (elderId: number, type?: string) =>
  apiClient.get<{ memories: Memory[] }>(`/memory/${elderId}`, {
    params: type ? { type } : {},
  }).then((r) => r.data.memories);

export const createMemory = (payload: {
  elder_id: number;
  type: string;
  title: string;
  description?: string;
  detail: Record<string, any>;
}) => apiClient.post<{ memory: Memory }>('/memory', payload).then((r) => r.data.memory);

export const updateMemory = (
  id: number,
  payload: { title?: string; description?: string; detail?: Record<string, any> }
) => apiClient.put<{ memory: Memory }>(`/memory/${id}`, payload).then((r) => r.data.memory);

export const deleteMemory = (id: number) =>
  apiClient.delete(`/memory/${id}`).then((r) => r.data);
