import { AWS_API_GATEWAY_URL } from '../config';

export interface AuditEntry {
  groupId: string;
  expenseId: string;
  action: string;
  details: string;
  userId: string;
  userName: string;
  date: string;
}

export async function fetchAuditLogs(groupId: string, userId: string): Promise<AuditEntry[]> {
  const response = await fetch(`${AWS_API_GATEWAY_URL}/audit?groupId=${groupId}&userId=${userId}`);
  if (!response.ok) throw new Error("Failed to load audit trail.");
  const data = await response.json();
  return data.logs || [];
}

export async function postAuditLog(groupId: string, userId: string, action: string, details: string) {
  return fetch(`${AWS_API_GATEWAY_URL}/audit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ groupId, userId, action, details })
  });
}
