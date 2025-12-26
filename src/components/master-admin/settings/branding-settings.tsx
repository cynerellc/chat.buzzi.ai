"use client";

import { motion } from "framer-motion";
import {
  ImagePlus,
  Palette,
  Type,
  Image,
  Code,
  Moon,
  Trash2,
  Upload,
  Sparkles,
} from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/utils";
import { Button, Card, CardHeader, CardBody, Input, Switch } from "@/components/ui";

export interface BrandingSettingsData {
  platformName: string;
  platformTagline: string;
  logoUrl: string;
  faviconUrl: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  darkModeEnabled: boolean;
  customCss: string;
  footerText: string;
  showPoweredBy: boolean;
}

interface BrandingSettingsProps {
  settings: BrandingSettingsData;
  onChange: (updates: Partial<BrandingSettingsData>) => void;
}

interface ColorPickerProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  description?: string;
}

function ColorPicker({ label, value, onChange, description }: ColorPickerProps) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-foreground block">
        {label}
      </label>
      <div className="flex items-center gap-3">
        <div className="relative group">
          <input
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-12 h-12 rounded-xl cursor-pointer border-2 border-border/50 transition-all duration-200 hover:border-primary/50 hover:scale-105"
          />
          <div
            className="absolute inset-0 rounded-xl pointer-events-none ring-2 ring-inset ring-white/20"
            style={{ backgroundColor: value }}
          />
        </div>
        <Input
          value={value}
          onValueChange={onChange}
          placeholder="#000000"
          size="sm"
          className="flex-1"
        />
      </div>
      {description && (
        <p className="text-xs text-muted-foreground">{description}</p>
      )}
    </div>
  );
}

interface ImageUploadProps {
  label: string;
  description: string;
  value: string;
  onChange: (value: string) => void;
  previewSize?: "sm" | "md";
}

function ImageUpload({ label, description, value, onChange, previewSize = "md" }: ImageUploadProps) {
  return (
    <div className="space-y-3">
      <label className="text-sm font-medium text-foreground block">
        {label}
      </label>
      <div
        className={cn(
          "border-2 border-dashed rounded-xl transition-all duration-200",
          value
            ? "border-primary/30 bg-primary/5"
            : "border-border/50 hover:border-primary/30 hover:bg-muted/30"
        )}
      >
        {value ? (
          <div className="p-6 flex flex-col items-center gap-4">
            <div className={cn(
              "relative rounded-xl overflow-hidden bg-muted/50",
              previewSize === "sm" ? "w-12 h-12" : "h-20 px-4"
            )}>
              <img
                src={value}
                alt={`${label} preview`}
                className={cn(
                  "object-contain",
                  previewSize === "sm" ? "w-full h-full" : "max-h-full w-auto"
                )}
              />
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
              onPress={() => onChange("")}
            >
              <Trash2 className="h-4 w-4" />
              Remove
            </Button>
          </div>
        ) : (
          <div className="p-8 text-center">
            <div className="w-14 h-14 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-3">
              <Upload className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
        )}
      </div>
      <Input
        placeholder="Or enter image URL"
        value={value}
        onValueChange={onChange}
        size="sm"
      />
    </div>
  );
}

export function BrandingSettings({ settings, onChange }: BrandingSettingsProps) {
  return (
    <div className="space-y-6">
      {/* Platform Identity */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary/15 to-primary/5">
              <Type className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold">Platform Identity</h3>
              <p className="text-sm text-muted-foreground">Name and branding text</p>
            </div>
          </div>
        </CardHeader>
        <CardBody className="pt-0 space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Input
              label="Platform Name"
              value={settings.platformName}
              onValueChange={(v) => onChange({ platformName: v })}
              description="The name displayed throughout the platform"
            />
            <Input
              label="Platform Tagline"
              value={settings.platformTagline}
              onValueChange={(v) => onChange({ platformTagline: v })}
              description="A short description or slogan"
            />
          </div>
          <Input
            label="Footer Text"
            value={settings.footerText}
            onValueChange={(v) => onChange({ footerText: v })}
            description="Text displayed in the footer of all pages"
          />
          <div className="pt-2">
            <Switch
              isSelected={settings.showPoweredBy}
              onValueChange={(v) => onChange({ showPoweredBy: v })}
            >
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-muted-foreground" />
                Show &quot;Powered by&quot; branding
              </div>
            </Switch>
          </div>
        </CardBody>
      </Card>

      {/* Logo & Favicon */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500/15 to-blue-600/5">
              <Image className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h3 className="font-semibold">Logo & Favicon</h3>
              <p className="text-sm text-muted-foreground">Brand imagery</p>
            </div>
          </div>
        </CardHeader>
        <CardBody className="pt-0">
          <div className="grid gap-6 md:grid-cols-2">
            <ImageUpload
              label="Platform Logo"
              description="Upload a logo image (PNG, SVG recommended)"
              value={settings.logoUrl}
              onChange={(v) => onChange({ logoUrl: v })}
              previewSize="md"
            />
            <ImageUpload
              label="Favicon"
              description="Upload a favicon (32x32 recommended)"
              value={settings.faviconUrl}
              onChange={(v) => onChange({ faviconUrl: v })}
              previewSize="sm"
            />
          </div>
        </CardBody>
      </Card>

      {/* Colors */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500/15 to-violet-600/5">
              <Palette className="h-5 w-5 text-violet-600 dark:text-violet-400" />
            </div>
            <div>
              <h3 className="font-semibold">Color Palette</h3>
              <p className="text-sm text-muted-foreground">Brand colors and theme</p>
            </div>
          </div>
        </CardHeader>
        <CardBody className="pt-0 space-y-6">
          {/* Color Preview Bar */}
          <div className="flex h-10 rounded-xl overflow-hidden shadow-sm">
            <div className="flex-1" style={{ backgroundColor: settings.primaryColor }} />
            <div className="flex-1" style={{ backgroundColor: settings.secondaryColor }} />
            <div className="flex-1" style={{ backgroundColor: settings.accentColor }} />
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            <ColorPicker
              label="Primary Color"
              value={settings.primaryColor}
              onChange={(v) => onChange({ primaryColor: v })}
              description="Main brand color"
            />
            <ColorPicker
              label="Secondary Color"
              value={settings.secondaryColor}
              onChange={(v) => onChange({ secondaryColor: v })}
              description="Supporting color"
            />
            <ColorPicker
              label="Accent Color"
              value={settings.accentColor}
              onChange={(v) => onChange({ accentColor: v })}
              description="Highlight elements"
            />
          </div>

          <div className="pt-2 border-t border-border/50">
            <Switch
              isSelected={settings.darkModeEnabled}
              onValueChange={(v) => onChange({ darkModeEnabled: v })}
            >
              <div className="flex items-center gap-2">
                <Moon className="h-4 w-4 text-muted-foreground" />
                Enable dark mode option for users
              </div>
            </Switch>
          </div>
        </CardBody>
      </Card>

      {/* Custom CSS */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500/15 to-amber-600/5">
              <Code className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <h3 className="font-semibold">Custom CSS</h3>
              <p className="text-sm text-muted-foreground">Advanced styling overrides</p>
            </div>
          </div>
        </CardHeader>
        <CardBody className="pt-0">
          <div className="p-3 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 text-sm mb-4 flex items-start gap-2">
            <Code className="h-4 w-4 mt-0.5 shrink-0" />
            <span>Custom CSS can override default styles. Use with caution as improper styles may break the UI.</span>
          </div>
          <textarea
            value={settings.customCss}
            onChange={(e) => onChange({ customCss: e.target.value })}
            className={cn(
              "w-full h-48 font-mono text-sm p-4 rounded-xl",
              "border border-border/50 bg-muted/30",
              "focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary",
              "placeholder:text-muted-foreground/50",
              "transition-all duration-200"
            )}
            placeholder="/* Custom CSS styles */

.my-custom-class {
  color: var(--primary);
}"
          />
        </CardBody>
      </Card>
    </div>
  );
}
