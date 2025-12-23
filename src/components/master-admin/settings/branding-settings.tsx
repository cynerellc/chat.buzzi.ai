"use client";

import { ImagePlus, Palette } from "lucide-react";
import { useState } from "react";

import { Button, Card, Input, Switch } from "@/components/ui";

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

export function BrandingSettings({ settings, onChange }: BrandingSettingsProps) {
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [faviconPreview, setFaviconPreview] = useState<string | null>(null);

  const handleLogoChange = (url: string) => {
    onChange({ logoUrl: url });
    setLogoPreview(url);
  };

  const handleFaviconChange = (url: string) => {
    onChange({ faviconUrl: url });
    setFaviconPreview(url);
  };

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h3 className="font-semibold mb-4">Platform Identity</h3>
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
          className="mt-4"
          description="Text displayed in the footer of all pages"
        />
        <div className="mt-4">
          <Switch
            isSelected={settings.showPoweredBy}
            onValueChange={(v) => onChange({ showPoweredBy: v })}
          >
            Show &quot;Powered by&quot; branding
          </Switch>
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="font-semibold mb-4">Logo & Favicon</h3>
        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <label className="text-sm font-medium text-default-700 block mb-2">
              Platform Logo
            </label>
            <div className="border-2 border-dashed border-divider rounded-lg p-6 text-center">
              {logoPreview || settings.logoUrl ? (
                <div className="space-y-3">
                  <img
                    src={logoPreview || settings.logoUrl}
                    alt="Logo preview"
                    className="max-h-16 mx-auto"
                  />
                  <Button
                    variant="flat"
                    size="sm"
                    onPress={() => {
                      setLogoPreview(null);
                      onChange({ logoUrl: "" });
                    }}
                  >
                    Remove
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <ImagePlus
                    size={32}
                    className="mx-auto text-default-400"
                  />
                  <p className="text-sm text-default-500">
                    Upload a logo image
                  </p>
                </div>
              )}
            </div>
            <Input
              className="mt-2"
              placeholder="Or enter logo URL"
              value={settings.logoUrl}
              onValueChange={handleLogoChange}
              size="sm"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-default-700 block mb-2">
              Favicon
            </label>
            <div className="border-2 border-dashed border-divider rounded-lg p-6 text-center">
              {faviconPreview || settings.faviconUrl ? (
                <div className="space-y-3">
                  <img
                    src={faviconPreview || settings.faviconUrl}
                    alt="Favicon preview"
                    className="w-8 h-8 mx-auto"
                  />
                  <Button
                    variant="flat"
                    size="sm"
                    onPress={() => {
                      setFaviconPreview(null);
                      onChange({ faviconUrl: "" });
                    }}
                  >
                    Remove
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <ImagePlus
                    size={32}
                    className="mx-auto text-default-400"
                  />
                  <p className="text-sm text-default-500">
                    Upload a favicon (32x32 recommended)
                  </p>
                </div>
              )}
            </div>
            <Input
              className="mt-2"
              placeholder="Or enter favicon URL"
              value={settings.faviconUrl}
              onValueChange={handleFaviconChange}
              size="sm"
            />
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Palette size={20} />
          <h3 className="font-semibold">Colors</h3>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <label className="text-sm font-medium text-default-700 block mb-2">
              Primary Color
            </label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={settings.primaryColor}
                onChange={(e) => onChange({ primaryColor: e.target.value })}
                className="w-10 h-10 rounded cursor-pointer border border-divider"
              />
              <Input
                value={settings.primaryColor}
                onValueChange={(v) => onChange({ primaryColor: v })}
                placeholder="#000000"
                size="sm"
                className="flex-1"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-default-700 block mb-2">
              Secondary Color
            </label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={settings.secondaryColor}
                onChange={(e) => onChange({ secondaryColor: e.target.value })}
                className="w-10 h-10 rounded cursor-pointer border border-divider"
              />
              <Input
                value={settings.secondaryColor}
                onValueChange={(v) => onChange({ secondaryColor: v })}
                placeholder="#000000"
                size="sm"
                className="flex-1"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-default-700 block mb-2">
              Accent Color
            </label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={settings.accentColor}
                onChange={(e) => onChange({ accentColor: e.target.value })}
                className="w-10 h-10 rounded cursor-pointer border border-divider"
              />
              <Input
                value={settings.accentColor}
                onValueChange={(v) => onChange({ accentColor: v })}
                placeholder="#000000"
                size="sm"
                className="flex-1"
              />
            </div>
          </div>
        </div>

        <div className="mt-4">
          <Switch
            isSelected={settings.darkModeEnabled}
            onValueChange={(v) => onChange({ darkModeEnabled: v })}
          >
            Enable dark mode option for users
          </Switch>
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="font-semibold mb-4">Custom CSS</h3>
        <p className="text-sm text-default-500 mb-3">
          Add custom CSS to override default styles. Use with caution.
        </p>
        <textarea
          value={settings.customCss}
          onChange={(e) => onChange({ customCss: e.target.value })}
          className="w-full h-40 font-mono text-sm p-3 rounded-lg border border-divider bg-default-50 focus:outline-none focus:ring-2 focus:ring-primary"
          placeholder="/* Custom CSS */"
        />
      </Card>
    </div>
  );
}
