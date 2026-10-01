import apiClient from './client';
import type { User } from '../types';

export interface LoginResponse {
  accessToken: string;
  tokenType: string;
  expiresIn: number;
  user: User;
}

export const authApi = {
  login: (username: string, password: string) =>
    apiClient.post<LoginResponse>('/auth/login', { username, password }).then((r) => r.data),
  me: () => apiClient.get<User>('/auth/me').then((r) => r.data),
  logout: () => apiClient.post('/auth/logout'),
  changePassword: (currentPassword: string, newPassword: string) =>
    apiClient.post('/auth/change-password', { currentPassword, newPassword }),
};
