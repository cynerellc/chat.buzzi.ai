"use client";

import { useSession } from "next-auth/react";
import { useCallback, useState } from "react";

interface UpdateProfileData {
  name?: string;
  image?: string;
}

export function useUser() {
  const { data: session, update } = useSession();
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const user = session?.user;

  const updateProfile = useCallback(
    async (data: UpdateProfileData) => {
      if (!user) {
        setError("Not authenticated");
        return false;
      }

      setIsUpdating(true);
      setError(null);

      try {
        const response = await fetch("/api/user/profile", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(data),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || "Failed to update profile");
        }

        // Update session with new data
        await update({
          user: {
            ...user,
            ...data,
          },
        });

        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
        return false;
      } finally {
        setIsUpdating(false);
      }
    },
    [user, update]
  );

  const changePassword = useCallback(
    async (currentPassword: string, newPassword: string) => {
      if (!user) {
        setError("Not authenticated");
        return false;
      }

      setIsUpdating(true);
      setError(null);

      try {
        const response = await fetch("/api/user/password", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ currentPassword, newPassword }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || "Failed to change password");
        }

        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
        return false;
      } finally {
        setIsUpdating(false);
      }
    },
    [user]
  );

  return {
    user,
    isUpdating,
    error,
    updateProfile,
    changePassword,
    clearError: () => setError(null),
  };
}
