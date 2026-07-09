import { AWS_API_GATEWAY_URL } from '../config';

export interface Schedule {
  groupId: string;
  expenseId: string;
  title: string;
  amount: number;
  dueDay: number;
  createdBy: string;
  date: string;
}

export async function fetchSchedules(groupId: string, userId: string): Promise<Schedule[]> {
  const response = await fetch(`${AWS_API_GATEWAY_URL}/schedules?groupId=${groupId}&userId=${userId}`);
  if (!response.ok) throw new Error("Failed to load schedules.");
  const data = await response.json();
  return data.schedules || [];
}

export async function createSchedule(groupId: string, userId: string, title: string, amount: number, dueDay: number): Promise<Schedule> {
  const response = await fetch(`${AWS_API_GATEWAY_URL}/schedules`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ groupId, userId, title, amount, dueDay })
  });
  if (!response.ok) throw new Error("Failed to create schedule.");
  return response.json();
}

export async function deleteSchedule(groupId: string, expenseId: string, userId: string) {
  return fetch(`${AWS_API_GATEWAY_URL}/schedules`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ groupId, expenseId, userId })
  });
}
