import { AWS_API_GATEWAY_URL } from '../config';

export type NoticeCategory = 'ANNOUNCEMENT' | 'TASK' | 'URGENT';

export interface Notice {
  groupId: string;
  expenseId: string;
  text: string;
  category?: NoticeCategory;
  eventDate?: string | null;
  acks?: string[];
  postedBy: string;
  postedByName: string;
  date: string;
}

export async function fetchNotices(groupId: string, userId: string): Promise<Notice[]> {
  const base = AWS_API_GATEWAY_URL.replace(/\/+$/, '');
  const res = await fetch(`${base}/notices?groupId=${encodeURIComponent(groupId)}&userId=${encodeURIComponent(userId)}`);
  if (!res.ok) throw new Error('Failed to fetch notices');
  const data = await res.json();
  return data.notices || [];
}

export async function postNotice(
  groupId: string,
  userId: string,
  text: string,
  category: NoticeCategory = 'ANNOUNCEMENT'
): Promise<Notice> {
  const base = AWS_API_GATEWAY_URL.replace(/\/+$/, '');
  const res = await fetch(`${base}/notices`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ groupId, userId, text, category })
  });
  if (!res.ok) throw new Error('Failed to post notice');
  return res.json();
}

export async function toggleNoticeAck(
  groupId: string,
  expenseId: string,
  userId: string,
  actorName: string
): Promise<Notice> {
  const base = AWS_API_GATEWAY_URL.replace(/\/+$/, '');
  const res = await fetch(`${base}/notices`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ groupId, expenseId, userId, actorName })
  });
  if (!res.ok) throw new Error('Failed to update reaction');
  return res.json();
}

export async function deleteNotice(groupId: string, expenseId: string, userId: string): Promise<void> {
  const base = AWS_API_GATEWAY_URL.replace(/\/+$/, '');
  const res = await fetch(`${base}/notices`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ groupId, expenseId, userId })
  });
  if (!res.ok) throw new Error('Failed to delete notice');
}