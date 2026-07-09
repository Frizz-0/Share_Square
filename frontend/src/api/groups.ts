import { AWS_API_GATEWAY_URL } from '../config';

export async function fetchUserGroups(userId: string) {
  const response = await fetch(`${AWS_API_GATEWAY_URL}/groups?userId=${userId}`);
  if (!response.ok) throw new Error("Failed to load groups.");
  const data = await response.json();
  return data.groups as { id: string; name: string; icon: string; inviteCode: string; memberIds: string[] }[];
}

export async function createGroup(name: string, icon: string, userId: string) {
  const response = await fetch(`${AWS_API_GATEWAY_URL}/groups`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, icon, userId })
  });
  if (!response.ok) throw new Error("Failed to create group.");
  return response.json();
}

export async function joinGroupByCode(inviteCode: string, userId: string) {
  const response = await fetch(`${AWS_API_GATEWAY_URL}/groups/join`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ inviteCode, userId })
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || "Failed to join group.");
  }
  return response.json();
}

export async function leaveGroup(groupId: string, userId: string, requesterId: string) {
  const response = await fetch(`${AWS_API_GATEWAY_URL}/groups/leave`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ groupId, userId, requesterId })
  });
  if (!response.ok) throw new Error("Failed to remove member.");
  return response.json();
}
