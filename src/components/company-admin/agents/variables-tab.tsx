"use client";

import { useState, useEffect } from "react";
import { Lock, Variable, Save, AlertCircle } from "lucide-react";

import { Button, Card, CardHeader, CardBody, Input, addToast } from "@/components/ui";
import type { AgentDetail, AgentVariableValue } from "@/hooks/company";

interface VariablesTabProps {
  agent: AgentDetail;
  onSave: (data: Partial<AgentDetail>) => Promise<void>;
  isSaving: boolean;
}

export function VariablesTab({ agent, onSave, isSaving }: VariablesTabProps) {
  const [variableValues, setVariableValues] = useState<Record<string, string>>({});
  const [hasChanges, setHasChanges] = useState(false);

  // Get variable definitions from the agent's package or from variableValues
  const variables: AgentVariableValue[] = agent.variableValues || [];
  const hasVariables = variables.length > 0;

  // Initialize values from agent's raw variable values
  useEffect(() => {
    if (agent.rawVariableValues) {
      setVariableValues(agent.rawVariableValues);
      setHasChanges(false);
    }
  }, [agent.rawVariableValues]);

  const updateValue = (name: string, value: string) => {
    setVariableValues((prev) => ({ ...prev, [name]: value }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    // Validate required fields
    for (const variable of variables) {
      if (variable.required && !variableValues[variable.name]?.trim()) {
        addToast({ title: `${variable.displayName} is required`, color: "warning" });
        return;
      }
    }

    try {
      await onSave({ variableValues: variableValues as unknown as AgentVariableValue[] });
      setHasChanges(false);
    } catch {
      // Error handling is done in the parent component
    }
  };

  if (!agent.packageId) {
    return (
      <Card>
        <CardBody className="py-12 text-center">
          <Variable className="mx-auto mb-4 text-muted-foreground" size={48} />
          <h3 className="text-lg font-semibold mb-2">No Package Selected</h3>
          <p className="text-muted-foreground">
            This agent was created without a package template.
            Variables are only available for agents created from packages.
          </p>
        </CardBody>
      </Card>
    );
  }

  if (!hasVariables) {
    return (
      <Card>
        <CardBody className="py-12 text-center">
          <Variable className="mx-auto mb-4 text-muted-foreground" size={48} />
          <h3 className="text-lg font-semibold mb-2">No Variables Defined</h3>
          <p className="text-muted-foreground">
            The package template for this agent does not define any configuration variables.
          </p>
        </CardBody>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Variable size={20} />
              <div>
                <h2 className="text-lg font-semibold">Configuration Variables</h2>
                <p className="text-sm text-muted-foreground">
                  Manage the configuration values for this agent
                </p>
              </div>
            </div>
            <Button
              color="primary"
              leftIcon={Save}
              onPress={handleSave}
              isLoading={isSaving}
              isDisabled={!hasChanges}
            >
              Save Changes
            </Button>
          </div>
        </CardHeader>
        <CardBody className="space-y-4">
          {variables.map((variable) => (
            <div key={variable.name} className="p-4 border border-default-200 rounded-lg">
              <div className="flex items-start gap-3">
                <div className={`p-2 rounded-lg ${variable.variableType === "secured_variable" ? "bg-warning-100" : "bg-default-100"}`}>
                  {variable.variableType === "secured_variable" ? (
                    <Lock size={18} className="text-warning-600" />
                  ) : (
                    <Variable size={18} className="text-default-500" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium">{variable.displayName}</span>
                    {variable.required && (
                      <span className="text-xs text-danger">Required</span>
                    )}
                    <code className="text-xs bg-default-100 px-1.5 py-0.5 rounded">
                      {variable.name}
                    </code>
                  </div>
                  {variable.description && (
                    <p className="text-sm text-muted-foreground mb-3">
                      {variable.description}
                    </p>
                  )}
                  <Input
                    placeholder={variable.placeholder || `Enter ${variable.displayName.toLowerCase()}`}
                    value={variableValues[variable.name] || ""}
                    onValueChange={(v) => updateValue(variable.name, v)}
                    type={variable.variableType === "secured_variable" ? "password" : "text"}
                  />
                  {variable.variableType === "secured_variable" && variable.value === "••••••••" && (
                    <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                      <AlertCircle size={12} />
                      Leave empty to keep the current value
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </CardBody>
      </Card>

      {/* Info Card */}
      <Card>
        <CardBody>
          <div className="flex items-start gap-3">
            <AlertCircle className="text-primary mt-0.5" size={18} />
            <div className="text-sm">
              <p className="font-medium">About Configuration Variables</p>
              <p className="text-muted-foreground mt-1">
                Configuration variables allow you to customize this agent&apos;s behavior without modifying the system prompt.
                Secured variables (marked with a lock icon) are encrypted and never displayed in logs or exports.
              </p>
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
