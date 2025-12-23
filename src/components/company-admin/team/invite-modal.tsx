"use client";

import { useState } from "react";
import { Mail, Shield, ShieldCheck, UserPlus } from "lucide-react";
import { Select, SelectItem } from "@heroui/react";

import {
  Button,
  Input,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from "@/components/ui";

interface InviteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInvite: (email: string, role: "company_admin" | "support_agent") => Promise<void>;
  isInviting: boolean;
}

const roleOptions = [
  {
    key: "support_agent",
    label: "Support Agent",
    description: "Handle conversations and support",
    icon: Shield,
  },
  {
    key: "company_admin",
    label: "Admin",
    description: "Full access to company settings",
    icon: ShieldCheck,
  },
];

export function InviteModal({
  isOpen,
  onClose,
  onInvite,
  isInviting,
}: InviteModalProps) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"company_admin" | "support_agent">("support_agent");
  const [error, setError] = useState<string | null>(null);

  const handleInvite = async () => {
    if (!email) {
      setError("Email is required");
      return;
    }

    if (!email.includes("@")) {
      setError("Please enter a valid email address");
      return;
    }

    setError(null);

    try {
      await onInvite(email, role);
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send invitation");
    }
  };

  const handleClose = () => {
    setEmail("");
    setRole("support_agent");
    setError(null);
    onClose();
  };

  const selectedRole = roleOptions.find((r) => r.key === role);
  const RoleIcon = selectedRole?.icon || Shield;

  return (
    <Modal isOpen={isOpen} onOpenChange={handleClose}>
      <ModalContent>
        <ModalHeader className="flex items-center gap-2">
          <UserPlus className="h-5 w-5" />
          Invite Team Member
        </ModalHeader>
        <ModalBody>
          <div className="space-y-4">
            <Input
              label="Email Address"
              placeholder="colleague@company.com"
              type="email"
              value={email}
              onValueChange={(value) => {
                setEmail(value);
                setError(null);
              }}
              startContent={<Mail className="w-4 h-4 text-default-400" />}
              isInvalid={!!error}
              errorMessage={error}
            />

            <Select
              label="Role"
              placeholder="Select a role"
              selectedKeys={[role]}
              onSelectionChange={(keys) => {
                const selected = Array.from(keys)[0] as string;
                if (selected) setRole(selected as "company_admin" | "support_agent");
              }}
              startContent={<RoleIcon className="w-4 h-4" />}
            >
              {roleOptions.map((option) => (
                <SelectItem key={option.key} textValue={option.label}>
                  <div className="flex items-center gap-3">
                    <option.icon className="w-4 h-4 text-default-500" />
                    <div>
                      <p className="font-medium">{option.label}</p>
                      <p className="text-xs text-default-500">{option.description}</p>
                    </div>
                  </div>
                </SelectItem>
              ))}
            </Select>

            <div className="p-4 bg-default-50 rounded-lg">
              <p className="text-sm font-medium mb-2">Role Permissions:</p>
              {role === "company_admin" ? (
                <ul className="text-sm text-default-500 space-y-1">
                  <li>- Full access to all features</li>
                  <li>- Manage team members and invitations</li>
                  <li>- Configure agents and settings</li>
                  <li>- Access billing and analytics</li>
                </ul>
              ) : (
                <ul className="text-sm text-default-500 space-y-1">
                  <li>- Handle customer conversations</li>
                  <li>- View assigned conversations</li>
                  <li>- Access knowledge base</li>
                  <li>- Limited dashboard access</li>
                </ul>
              )}
            </div>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="light" onPress={handleClose}>
            Cancel
          </Button>
          <Button
            color="primary"
            isLoading={isInviting}
            isDisabled={!email}
            onPress={handleInvite}
            leftIcon={Mail}
          >
            Send Invitation
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

// Resend invitation modal
interface ResendInviteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onResend: () => Promise<void>;
  isResending: boolean;
  email: string;
}

export function ResendInviteModal({
  isOpen,
  onClose,
  onResend,
  isResending,
  email,
}: ResendInviteModalProps) {
  const handleResend = async () => {
    await onResend();
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onOpenChange={onClose}>
      <ModalContent>
        <ModalHeader>Resend Invitation</ModalHeader>
        <ModalBody>
          <p>
            Are you sure you want to resend the invitation to{" "}
            <strong>{email}</strong>?
          </p>
          <p className="text-sm text-default-500 mt-2">
            This will send a new invitation email and extend the expiration date.
          </p>
        </ModalBody>
        <ModalFooter>
          <Button variant="light" onPress={onClose}>
            Cancel
          </Button>
          <Button
            color="primary"
            isLoading={isResending}
            onPress={handleResend}
            leftIcon={Mail}
          >
            Resend Invitation
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
