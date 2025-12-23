import useSWR from "swr";
import useSWRMutation from "swr/mutation";

import type { TeamResponse } from "@/app/api/company/team/route";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

// Team Hook
export function useTeam() {
  const { data, error, isLoading, mutate } = useSWR<TeamResponse>(
    "/api/company/team",
    fetcher
  );

  return {
    members: data?.members ?? [],
    invitations: data?.invitations ?? [],
    isLoading,
    isError: error,
    mutate,
  };
}

// Invite Team Member Mutation
async function sendInvitation(
  url: string,
  { arg }: { arg: { email: string; role: "company_admin" | "support_agent" } }
) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(arg),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to send invitation");
  }

  return response.json();
}

export function useInviteTeamMember() {
  const { trigger, isMutating, error } = useSWRMutation(
    "/api/company/team/invite",
    sendInvitation
  );

  return {
    invite: trigger,
    isInviting: isMutating,
    error,
  };
}

// Revoke Invitation Mutation
async function revokeInvitation(
  url: string,
  { arg }: { arg: { invitationId: string } }
) {
  const response = await fetch(`${url}?id=${arg.invitationId}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to revoke invitation");
  }

  return response.json();
}

export function useRevokeInvitation() {
  const { trigger, isMutating, error } = useSWRMutation(
    "/api/company/team/invite",
    revokeInvitation
  );

  return {
    revoke: trigger,
    isRevoking: isMutating,
    error,
  };
}

// Update Team Member Mutation
async function updateTeamMember(
  url: string,
  { arg }: { arg: { userId: string; role?: string; status?: string } }
) {
  const { userId, ...data } = arg;
  const response = await fetch(`/api/company/team/${userId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to update team member");
  }

  return response.json();
}

export function useUpdateTeamMember() {
  const { trigger, isMutating, error } = useSWRMutation(
    "/api/company/team",
    updateTeamMember
  );

  return {
    updateMember: trigger,
    isUpdating: isMutating,
    error,
  };
}

// Remove Team Member Mutation
async function removeTeamMember(
  url: string,
  { arg }: { arg: { userId: string } }
) {
  const response = await fetch(`/api/company/team/${arg.userId}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to remove team member");
  }

  return response.json();
}

export function useRemoveTeamMember() {
  const { trigger, isMutating, error } = useSWRMutation(
    "/api/company/team",
    removeTeamMember
  );

  return {
    removeMember: trigger,
    isRemoving: isMutating,
    error,
  };
}
