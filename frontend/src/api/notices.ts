import { AWS_API_GATEWAY_URL } from '../config';

export interface Notice {
  groupId: string;
  expenseId: string;
  text: string;
  postedBy: string;
  postedByName: string;
  date: string;
}

export async function fetchNotices(groupId: string, userId: string): Promise<Notice[]> {
  const response = await fetch(`${AWS_API_GATEWAY_URL}/notices?groupId=${groupId}&userId=${userId}`);
  if (!response.ok) throw new Error("Failed to load notices.");
  const data = await response.json();
  return data.notices || [];
}

export async function postNotice(groupId: string, userId: string, text: string): Promise<Notice> {
  const response = await fetch(`${AWS_API_GATEWAY_URL}/notices`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ groupId, userId, text })
  });
  if (!response.ok) throw new Error("Failed to post notice.");
  return response.json();
}

export async function deleteNotice(groupId: string, expenseId: string, userId: string) {
  return fetch(`${AWS_API_GATEWAY_URL}/notices`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ groupId, expenseId, userId })
  });
}
