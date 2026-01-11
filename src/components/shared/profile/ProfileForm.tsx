"use client";

import { User, Mail, Phone } from "lucide-react";

import { Input } from "@/components/ui";

export interface ProfileFormData {
  name: string;
  email: string;
  phone: string;
}

interface ProfileFormProps {
  data: ProfileFormData;
  onChange: (field: keyof ProfileFormData, value: string) => void;
  isLoading?: boolean;
}

export function ProfileForm({ data, onChange, isLoading }: ProfileFormProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Input
        label="Display Name"
        placeholder="Your name"
        value={data.name}
        onChange={(e) => onChange("name", e.target.value)}
        startContent={<User size={16} className="text-muted-foreground" />}
        isDisabled={isLoading}
      />

      <Input
        label="Email"
        value={data.email}
        isDisabled
        startContent={<Mail size={16} className="text-muted-foreground" />}
        helperText="Email cannot be changed"
      />

      <Input
        label="Phone"
        placeholder="Your phone number"
        value={data.phone}
        onChange={(e) => onChange("phone", e.target.value)}
        startContent={<Phone size={16} className="text-muted-foreground" />}
        isDisabled={isLoading}
      />
    </div>
  );
}
