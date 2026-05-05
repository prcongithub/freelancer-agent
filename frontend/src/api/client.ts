import axios from 'axios';
import type { Project, Bid, DashboardData, Settings } from '../types/api';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api/v1',
  headers: { 'Content-Type': 'application/json' }
});

export const fetchDashboard = () =>
  api.get<DashboardData>('/dashboard');

export const fetchProjects = (status?: string) =>
  api.get<{ projects: Project[] }>('/projects', {
    params: status ? { status } : {}
  });

export const fetchBids = (status?: string) =>
  api.get<{ bids: Bid[] }>('/bids', {
    params: status ? { status } : {}
  });

export const approveBid = (projectId: string) =>
  api.post<{ message: string }>(`/projects/${projectId}/approve_bid`);

export const rejectProject = (projectId: string) =>
  api.post<{ project: Project }>(`/projects/${projectId}/reject`);

export const fetchSettings = () =>
  api.get<{ settings: Settings }>('/settings');

export const updateSettings = (data: Partial<Settings>) =>
  api.patch<{ settings: Settings }>('/settings', data);

export default api;
