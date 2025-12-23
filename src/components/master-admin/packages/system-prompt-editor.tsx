"use client";

import { Badge, Card, Textarea } from "@/components/ui";

interface SystemPromptEditorProps {
  value: string;
  onChange: (value: string) => void;
  maxLength?: number;
}

const availableVariables = [
  { name: "{company_name}", description: "The company name" },
  { name: "{agent_name}", description: "The agent name" },
  { name: "{current_date}", description: "Today's date" },
  { name: "{business_hours}", description: "Company business hours" },
];

export function SystemPromptEditor({
  value,
  onChange,
  maxLength = 4000,
}: SystemPromptEditorProps) {
  const insertVariable = (variable: string) => {
    onChange(value + variable);
  };

  return (
    <Card className="p-6">
      <h4 className="font-medium mb-2">System Prompt Template</h4>
      <p className="text-sm text-default-500 mb-4">
        This is the default system prompt for agents using this package.
        Companies can customize this for their specific needs.
      </p>

      <div className="mb-4">
        <p className="text-sm text-default-600 mb-2">Available Variables:</p>
        <div className="flex flex-wrap gap-2">
          {availableVariables.map((variable) => (
            <button
              key={variable.name}
              type="button"
              onClick={() => insertVariable(variable.name)}
              className="inline-flex items-center"
            >
              <Badge
                variant="default"
                size="sm"
                className="cursor-pointer hover:bg-default-200 transition-colors"
              >
                {variable.name}
              </Badge>
            </button>
          ))}
        </div>
      </div>

      <Textarea
        value={value}
        onValueChange={onChange}
        minRows={8}
        maxRows={20}
        placeholder="You are a helpful customer support agent for {company_name}..."
        classNames={{
          input: "font-mono text-sm",
        }}
      />

      <p className="text-xs text-default-400 mt-2 text-right">
        {value.length} / {maxLength} characters
      </p>
    </Card>
  );
}
