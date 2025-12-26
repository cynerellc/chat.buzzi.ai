"use client";

import { useState, useEffect } from "react";
import {
  Settings,
  Bell,
  MessageSquare,
  Palette,
  Keyboard,
  Save,
  User,
  Mail,
  Phone,
  RefreshCw,
} from "lucide-react";

import { PageHeader } from "@/components/layouts";
import {
  Card,
  Button,
  Input,
  Spinner,
  EmptyState,
} from "@/components/ui";
import { Toggle } from "@/components/ui/toggle";
import { cn } from "@/lib/utils";

interface Profile {
  id: string;
  name: string | null;
  email: string;
  phone: string | null;
  avatarUrl: string | null;
}

interface AgentSettings {
  notifications: {
    sound: boolean;
    desktop: boolean;
    email: boolean;
    newConversation: boolean;
    newMessage: boolean;
    escalation: boolean;
    mentions: boolean;
  };
  chat: {
    enterToSend: boolean;
    showTypingIndicator: boolean;
    autoAwayMinutes: number;
  };
  display: {
    theme: "light" | "dark" | "system";
    compactMode: boolean;
    showAvatars: boolean;
    fontSize: "small" | "medium" | "large";
  };
  shortcuts: {
    enabled: boolean;
  };
}

export default function AgentSettingsPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [settings, setSettings] = useState<AgentSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Fetch settings
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await fetch("/api/support-agent/settings");
        if (!response.ok) throw new Error("Failed to fetch settings");

        const data = await response.json();
        setProfile(data.profile);
        setSettings(data.settings);
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, []);

  // Update settings helper
  const updateSettings = <K extends keyof AgentSettings>(
    category: K,
    key: keyof AgentSettings[K],
    value: AgentSettings[K][typeof key]
  ) => {
    if (!settings) return;

    setSettings({
      ...settings,
      [category]: {
        ...settings[category],
        [key]: value,
      },
    });
    setHasChanges(true);
  };

  // Update profile helper
  const updateProfile = (key: keyof Profile, value: string) => {
    if (!profile) return;
    setProfile({ ...profile, [key]: value });
    setHasChanges(true);
  };

  // Save settings
  const handleSave = async () => {
    if (!settings || !profile) return;

    try {
      setSaving(true);
      setError(null);

      const response = await fetch("/api/support-agent/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: profile.name,
          phone: profile.phone,
          settings,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to save settings");
      }

      setHasChanges(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error && !settings) {
    return (
      <Card className="p-8">
        <EmptyState
          icon={Settings}
          title="Error loading settings"
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

  if (!settings || !profile) return null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Settings"
        description="Customize your support agent experience"
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

      {/* Profile Section */}
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <User size={20} className="text-muted-foreground" />
          <h2 className="text-lg font-semibold">Profile</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Display Name"
            placeholder="Your name"
            value={profile.name ?? ""}
            onChange={(e) => updateProfile("name", e.target.value)}
            startContent={<User size={16} className="text-muted-foreground" />}
          />

          <Input
            label="Email"
            value={profile.email}
            isDisabled
            startContent={<Mail size={16} className="text-muted-foreground" />}
          />

          <Input
            label="Phone"
            placeholder="Your phone number"
            value={profile.phone ?? ""}
            onChange={(e) => updateProfile("phone", e.target.value)}
            startContent={<Phone size={16} className="text-muted-foreground" />}
          />
        </div>
      </Card>

      {/* Notifications Section */}
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <Bell size={20} className="text-muted-foreground" />
          <h2 className="text-lg font-semibold">Notifications</h2>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Sound notifications</p>
              <p className="text-sm text-muted-foreground">Play sound for new messages</p>
            </div>
            <Toggle
              isSelected={settings.notifications.sound}
              onValueChange={(v) => updateSettings("notifications", "sound", v)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Desktop notifications</p>
              <p className="text-sm text-muted-foreground">Show browser notifications</p>
            </div>
            <Toggle
              isSelected={settings.notifications.desktop}
              onValueChange={(v) => updateSettings("notifications", "desktop", v)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Email notifications</p>
              <p className="text-sm text-muted-foreground">Receive email for missed messages</p>
            </div>
            <Toggle
              isSelected={settings.notifications.email}
              onValueChange={(v) => updateSettings("notifications", "email", v)}
            />
          </div>

          <div className="border-t pt-4 mt-4">
            <p className="text-sm font-medium text-foreground mb-3">Notify me about:</p>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">New conversations assigned to me</span>
                <Toggle
                  size="sm"
                  isSelected={settings.notifications.newConversation}
                  onValueChange={(v) => updateSettings("notifications", "newConversation", v)}
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">New messages in my conversations</span>
                <Toggle
                  size="sm"
                  isSelected={settings.notifications.newMessage}
                  onValueChange={(v) => updateSettings("notifications", "newMessage", v)}
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Escalation alerts</span>
                <Toggle
                  size="sm"
                  isSelected={settings.notifications.escalation}
                  onValueChange={(v) => updateSettings("notifications", "escalation", v)}
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">When someone mentions me</span>
                <Toggle
                  size="sm"
                  isSelected={settings.notifications.mentions}
                  onValueChange={(v) => updateSettings("notifications", "mentions", v)}
                />
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Chat Section */}
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <MessageSquare size={20} className="text-muted-foreground" />
          <h2 className="text-lg font-semibold">Chat</h2>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Enter to send</p>
              <p className="text-sm text-muted-foreground">Press Enter to send messages (Shift+Enter for new line)</p>
            </div>
            <Toggle
              isSelected={settings.chat.enterToSend}
              onValueChange={(v) => updateSettings("chat", "enterToSend", v)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Show typing indicator</p>
              <p className="text-sm text-muted-foreground">Let customers see when you&apos;re typing</p>
            </div>
            <Toggle
              isSelected={settings.chat.showTypingIndicator}
              onValueChange={(v) => updateSettings("chat", "showTypingIndicator", v)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Auto-away after</p>
              <p className="text-sm text-muted-foreground">Set status to away after inactivity (0 to disable)</p>
            </div>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={0}
                max={120}
                value={settings.chat.autoAwayMinutes.toString()}
                onChange={(e) => updateSettings("chat", "autoAwayMinutes", parseInt(e.target.value) || 0)}
                className="w-20"
              />
              <span className="text-sm text-muted-foreground">minutes</span>
            </div>
          </div>
        </div>
      </Card>

      {/* Display Section */}
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <Palette size={20} className="text-muted-foreground" />
          <h2 className="text-lg font-semibold">Display</h2>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Theme</p>
              <p className="text-sm text-muted-foreground">Choose your preferred color scheme</p>
            </div>
            <div className="flex gap-2">
              {(["light", "dark", "system"] as const).map((theme) => (
                <button
                  key={theme}
                  onClick={() => updateSettings("display", "theme", theme)}
                  className={cn(
                    "px-3 py-1.5 text-sm rounded-md capitalize transition-colors",
                    settings.display.theme === theme
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted hover:bg-muted/80"
                  )}
                >
                  {theme}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Compact mode</p>
              <p className="text-sm text-muted-foreground">Reduce spacing for more content</p>
            </div>
            <Toggle
              isSelected={settings.display.compactMode}
              onValueChange={(v) => updateSettings("display", "compactMode", v)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Show avatars</p>
              <p className="text-sm text-muted-foreground">Display user avatars in conversations</p>
            </div>
            <Toggle
              isSelected={settings.display.showAvatars}
              onValueChange={(v) => updateSettings("display", "showAvatars", v)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Font size</p>
              <p className="text-sm text-muted-foreground">Adjust text size in conversations</p>
            </div>
            <div className="flex gap-2">
              {(["small", "medium", "large"] as const).map((size) => (
                <button
                  key={size}
                  onClick={() => updateSettings("display", "fontSize", size)}
                  className={cn(
                    "px-3 py-1.5 text-sm rounded-md capitalize transition-colors",
                    settings.display.fontSize === size
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted hover:bg-muted/80"
                  )}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {/* Shortcuts Section */}
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <Keyboard size={20} className="text-muted-foreground" />
          <h2 className="text-lg font-semibold">Keyboard Shortcuts</h2>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Enable keyboard shortcuts</p>
              <p className="text-sm text-muted-foreground">Use keyboard shortcuts for quick actions</p>
            </div>
            <Toggle
              isSelected={settings.shortcuts.enabled}
              onValueChange={(v) => updateSettings("shortcuts", "enabled", v)}
            />
          </div>

          {settings.shortcuts.enabled && (
            <div className="border-t pt-4 mt-4">
              <p className="text-sm font-medium text-foreground mb-3">Available shortcuts:</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                <div className="flex justify-between py-1">
                  <span className="text-foreground">Send message</span>
                  <kbd className="bg-muted px-2 py-0.5 rounded text-xs">Enter</kbd>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-foreground">New line</span>
                  <kbd className="bg-muted px-2 py-0.5 rounded text-xs">Shift + Enter</kbd>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-foreground">Canned responses</span>
                  <kbd className="bg-muted px-2 py-0.5 rounded text-xs">Cmd/Ctrl + K</kbd>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-foreground">Resolve conversation</span>
                  <kbd className="bg-muted px-2 py-0.5 rounded text-xs">Cmd/Ctrl + Shift + R</kbd>
                </div>
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
