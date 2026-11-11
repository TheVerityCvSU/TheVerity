// Instructor approval data service: handles accepting or declining pending instructor accounts.
import { apiFetch } from './api';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export const approveInstructor = async (email) => {
  const response = await apiFetch(`${API}/users/${encodeURIComponent(email)}/status`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'Active' })
  });

  if (!response.ok) {
    throw new Error(`Failed to approve user: ${response.status}`);
  }
  return response;
};

export const rejectInstructor = async (email) => {
  const response = await apiFetch(`${API}/users/${encodeURIComponent(email)}`, {
    method: 'DELETE'
  });

  if (!response.ok) {
    throw new Error(`Failed to reject user: ${response.status}`);
  }
  return response;
};

