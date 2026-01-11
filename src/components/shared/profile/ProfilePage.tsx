"use client";

import { useState, useEffect, useCallback } from "react";
import { Save, User } from "lucide-react";

import { PageHeader } from "@/components/layouts";
import { useSetPageTitle } from "@/contexts/page-context";
import { Card, Button, Spinner, EmptyState } from "@/components/ui";
import { toast } from "@/components/ui/toast";
import { useAuth } from "@/hooks/useAuth";

import { ProfileForm, type ProfileFormData } from "./ProfileForm";
import { AvatarUploadSection } from "./AvatarUploadSection";

interface UserProfile {
  id: string;
  name: string | null;
  email: string;
  phone: string | null;
  avatarUrl: string | null;
  image: string | null;
  role: string;
  activeCompanyId: string | null;
}

export function ProfilePage() {
  useSetPageTitle("My Profile");
  const { refreshSession } = useAuth();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [formData, setFormData] = useState<ProfileFormData>({
    name: "",
    email: "",
    phone: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  // Fetch profile
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const response = await fetch("/api/user/profile");
        if (!response.ok) {
          throw new Error("Failed to fetch profile");
        }

        const data = await response.json();
        setProfile(data.profile);
        setFormData({
          name: data.profile.name ?? "",
          email: data.profile.email,
          phone: data.profile.phone ?? "",
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, []);

  // Handle form field changes
  const handleFieldChange = useCallback((field: keyof ProfileFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setHasChanges(true);
  }, []);

  // Handle avatar change
  const handleAvatarChange = useCallback(async (newAvatarUrl: string) => {
    setProfile((prev) => prev ? { ...prev, avatarUrl: newAvatarUrl } : prev);
    toast.success("Avatar updated successfully");
    // Refresh session so avatar shows in header immediately
    await refreshSession();
  }, [refreshSession]);

  // Save profile
  const handleSave = useCallback(async () => {
    if (!profile) return;

    try {
      setSaving(true);
      setError(null);

      const response = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name || null,
          phone: formData.phone || null,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to save profile");
      }

      const data = await response.json();
      setProfile(data.profile);
      setHasChanges(false);
      toast.success("Profile saved successfully");
      // Refresh session so name shows in header immediately
      await refreshSession();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save";
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }, [profile, formData, refreshSession]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error && !profile) {
    return (
      <Card className="p-8">
        <EmptyState
          icon={User}
          title="Error loading profile"
          description={error}
          action={{
            label: "Try Again",
            onClick: () => window.location.reload(),
            variant: "ghost",
          }}
        />
      </Card>
    );
  }

  if (!profile) return null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Profile"
        description="Manage your personal information and avatar"
        actions={
          <Button
            color="primary"
            size="sm"
            leftIcon={Save}
            onClick={handleSave}
            isLoading={saving}
            disabled={!hasChanges}
          >
            Save Changes
          </Button>
        }
      />

      {error && (
        <div className="bg-danger-50 text-danger-800 rounded-lg p-3 text-sm">
          {error}
        </div>
      )}

      {/* Avatar Section */}
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <User size={20} className="text-muted-foreground" />
          <h2 className="text-lg font-semibold">Profile Photo</h2>
        </div>

        <AvatarUploadSection
          currentAvatarUrl={profile.avatarUrl ?? profile.image}
          userName={profile.name}
          onAvatarChange={handleAvatarChange}
        />
      </Card>

      {/* Profile Information Section */}
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <User size={20} className="text-muted-foreground" />
          <h2 className="text-lg font-semibold">Profile Information</h2>
        </div>

        <ProfileForm
          data={formData}
          onChange={handleFieldChange}
          isLoading={saving}
        />
      </Card>
    </div>
  );
}
