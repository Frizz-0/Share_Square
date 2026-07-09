import { AWS_API_GATEWAY_URL } from '../config';

export async function fetchGroupData(groupId: string, userId: string) {
  const response = await fetch(`${AWS_API_GATEWAY_URL}/expenses?groupId=${groupId}&userId=${userId}`);
  if (!response.ok) throw new Error("Cloud validation block.");
  return response.json();
}

export async function postExpense(payload: Record<string, unknown>) {
  const response = await fetch(`${AWS_API_GATEWAY_URL}/expenses`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  return response.json();
}

export async function putExpense(payload: Record<string, unknown>) {
  return fetch(`${AWS_API_GATEWAY_URL}/expenses`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
}

export async function deleteExpense(groupId: string, expenseId: number, userId: string) {
  return fetch(`${AWS_API_GATEWAY_URL}/expenses`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ groupId, expenseId: String(expenseId), userId })
  });
}
