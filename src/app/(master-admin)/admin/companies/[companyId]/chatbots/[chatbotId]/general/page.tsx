"use client";

import { Save } from "lucide-react";
import { useState, useEffect } from "react";

import { FormSection, FormFieldWrapper } from "@/components/shared";
import { Button, Card, Input, Textarea, Select, addToast } from "@/components/ui";
import { updateCompanyChatbot } from "@/hooks/master-admin";

import { useChatbotContext } from "../chatbot-context";

export default function ChatbotGeneralPage() {
  const { chatbot, companyId, chatbotId, refresh } = useChatbotContext();
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    status: "draft" as "draft" | "active" | "paused" | "archived",
  });

  useEffect(() => {
    if (chatbot) {
      setFormData({
        name: chatbot.name,
        description: chatbot.description ?? "",
        status: chatbot.status as "draft" | "active" | "paused" | "archived",
      });
    }
  }, [chatbot]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateCompanyChatbot(companyId, chatbotId, formData);
      addToast({ title: "Chatbot updated successfully", color: "success" });
      refresh();
    } catch {
      addToast({ title: "Failed to update chatbot", color: "danger" });
    } finally {
      setIsSaving(false);
    }
  };

  if (!chatbot) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">General Settings</h2>
          <p className="text-sm text-muted-foreground">
            Configure basic chatbot information
          </p>
        </div>
        <Button
          startContent={<Save size={16} />}
          onClick={handleSave}
          isLoading={isSaving}
        >
          Save Changes
        </Button>
      </div>

      <Card className="p-6">
        <FormSection title="Basic Information">
          <FormFieldWrapper label="Chatbot Name" required>
            <Input
              value={formData.name}
              onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="Enter chatbot name"
            />
          </FormFieldWrapper>

          <FormFieldWrapper label="Description">
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
              placeholder="Enter a description for this chatbot"
              rows={3}
            />
          </FormFieldWrapper>

          <FormFieldWrapper label="Status">
            <Select
              selectedKeys={new Set([formData.status])}
              onSelectionChange={(keys) => {
                const status = Array.from(keys)[0] as "draft" | "active" | "paused" | "archived";
                setFormData((prev) => ({ ...prev, status }));
              }}
              options={[
                { value: "draft", label: "Draft" },
                { value: "active", label: "Active" },
                { value: "paused", label: "Paused" },
                { value: "archived", label: "Archived" },
              ]}
            />
          </FormFieldWrapper>
        </FormSection>
      </Card>

      <Card className="p-6">
        <FormSection title="Package Information">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Package</p>
              <p className="font-medium">{chatbot.packageName}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Model</p>
              <p className="font-medium">{chatbot.modelId}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Temperature</p>
              <p className="font-medium">{chatbot.temperature}%</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Conversations</p>
              <p className="font-medium">{chatbot.conversationCount}</p>
            </div>
          </div>
        </FormSection>
      </Card>
    </div>
  );
}
