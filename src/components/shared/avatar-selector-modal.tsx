"use client";

import { Bot, Check, Upload, Loader2 } from "lucide-react";
import { useState, useEffect, useCallback, useRef } from "react";
import useSWR from "swr";

import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { addToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

import { ImageCropper, type CropData } from "./image-cropper";

interface PresetAvatar {
  id: string;
  url: string;
  name: string;
}

interface AvatarSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (avatarUrl: string) => void;
  currentAvatar?: string;
  agentName?: string;
}

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch");
  return res.json();
};

type ViewMode = "select" | "crop";

export function AvatarSelectorModal({
  isOpen,
  onClose,
  onSelect,
  currentAvatar,
  agentName = "Agent",
}: AvatarSelectorModalProps) {
  const [selectedAvatar, setSelectedAvatar] = useState<string | null>(currentAvatar ?? null);
  const [viewMode, setViewMode] = useState<ViewMode>("select");
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch preset avatars
  const { data, isLoading: isLoadingPresets } = useSWR<{ avatars: PresetAvatar[] }>(
    isOpen ? "/api/avatars/presets" : null,
    fetcher
  );

  const presetAvatars = data?.avatars ?? [];

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedAvatar(currentAvatar ?? null);
      setViewMode("select");
      setUploadedImage(null);
    }
  }, [isOpen, currentAvatar]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      addToast({ title: "Please select an image file", color: "danger" });
      return;
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      addToast({ title: "Image must be less than 5MB", color: "danger" });
      return;
    }

    // Read file and switch to crop mode
    const reader = new FileReader();
    reader.onload = () => {
      setUploadedImage(reader.result as string);
      setViewMode("crop");
    };
    reader.readAsDataURL(file);

    // Reset input
    e.target.value = "";
  }, []);

  const handleCropComplete = useCallback(async (cropData: CropData) => {
    if (!uploadedImage) return;

    setIsUploading(true);
    try {
      // Convert data URL to blob
      const response = await fetch(uploadedImage);
      const blob = await response.blob();

      // Create form data
      const formData = new FormData();
      formData.append("file", blob, "avatar.png");
      formData.append("cropData", JSON.stringify(cropData));
      formData.append("circularCrop", "true");

      // Upload to server
      const uploadResponse = await fetch("/api/avatars/upload", {
        method: "POST",
        body: formData,
      });

      if (!uploadResponse.ok) {
        const errorData = await uploadResponse.json();
        throw new Error(errorData.error || "Upload failed");
      }

      const result = await uploadResponse.json();
      setSelectedAvatar(result.avatarUrl);
      setViewMode("select");
      setUploadedImage(null);
      addToast({ title: "Avatar uploaded successfully", color: "success" });
    } catch (error) {
      console.error("Upload error:", error);
      addToast({
        title: error instanceof Error ? error.message : "Failed to upload avatar",
        color: "danger",
      });
    } finally {
      setIsUploading(false);
    }
  }, [uploadedImage]);

  const handleCropCancel = useCallback(() => {
    setViewMode("select");
    setUploadedImage(null);
  }, []);

  const handleConfirm = () => {
    if (selectedAvatar) {
      onSelect(selectedAvatar);
    }
    onClose();
  };

  const handleClearAvatar = () => {
    setSelectedAvatar(null);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={viewMode === "crop" ? "Crop Avatar" : "Select Avatar"}
      description={
        viewMode === "crop"
          ? "Adjust the crop area for your avatar"
          : `Choose an avatar for ${agentName}`
      }
      size="lg"
    >
      {viewMode === "crop" && uploadedImage ? (
        <div className="py-4">
          {isUploading ? (
            <div className="flex flex-col items-center justify-center h-64 gap-4">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Uploading avatar...</p>
            </div>
          ) : (
            <ImageCropper
              image={uploadedImage}
              onCropComplete={handleCropComplete}
              onCancel={handleCropCancel}
              aspectRatio={1}
              cropShape="round"
            />
          )}
        </div>
      ) : (
        <>
          {/* Current Selection Preview */}
          <div className="flex items-center gap-4 mb-6 p-4 bg-muted/30 rounded-lg">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center overflow-hidden border-2 border-primary">
              {selectedAvatar ? (
                <img
                  src={selectedAvatar}
                  alt="Selected avatar"
                  className="w-full h-full object-cover"
                />
              ) : (
                <Bot size={32} className="text-muted-foreground" />
              )}
            </div>
            <div className="flex-1">
              <p className="font-medium">
                {selectedAvatar ? "Selected Avatar" : "No Avatar Selected"}
              </p>
              <p className="text-sm text-muted-foreground">
                {selectedAvatar ? "Click confirm to apply" : "Select a preset or upload custom"}
              </p>
            </div>
            {selectedAvatar && (
              <Button variant="ghost" size="sm" onClick={handleClearAvatar}>
                Clear
              </Button>
            )}
          </div>

          {/* Upload Button */}
          <div className="mb-6">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
            />
            <Button
              variant="outline"
              className="w-full"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload size={16} className="mr-2" />
              Upload Custom Avatar
            </Button>
          </div>

          {/* Preset Avatars Grid */}
          <div className="mb-6">
            <h4 className="text-sm font-medium mb-3">Preset Avatars</h4>
            {isLoadingPresets ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : presetAvatars.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-muted-foreground">
                No preset avatars available
              </div>
            ) : (
              <div className="grid grid-cols-5 sm:grid-cols-6 gap-3 max-h-64 overflow-y-auto p-1">
                {presetAvatars.map((avatar) => (
                  <button
                    key={avatar.id}
                    type="button"
                    onClick={() => setSelectedAvatar(avatar.url)}
                    className={cn(
                      "relative w-12 h-12 sm:w-14 sm:h-14 rounded-full overflow-hidden border-2 transition-all hover:scale-105 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
                      selectedAvatar === avatar.url
                        ? "border-primary ring-2 ring-primary ring-offset-2"
                        : "border-transparent hover:border-primary/50"
                    )}
                    title={avatar.name}
                  >
                    <img
                      src={avatar.url}
                      alt={avatar.name}
                      className="w-full h-full object-cover"
                    />
                    {selectedAvatar === avatar.url && (
                      <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                        <Check size={20} className="text-primary" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleConfirm}>
              Confirm
            </Button>
          </div>
        </>
      )}
    </Modal>
  );
}
