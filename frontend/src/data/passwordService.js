// Password service: handles updating the user's password via the backend API.
import { apiFetch } from './api';

export const changeUserPassword = async ({ currentPassword, newPassword }) => {
  const res = await apiFetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/users/change-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      currentPassword,
      newPassword
    })
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || 'Current password is incorrect.');
  }
  return data;
};

