"use client";

import { useState, useRef, useCallback } from "react";
import { Camera, Upload, Loader2 } from "lucide-react";

import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { ImageCropper, type CropData } from "@/components/shared/image-cropper";
import { cn } from "@/lib/utils";

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const AVATAR_SIZE = 120; // Output size in pixels

interface AvatarUploadSectionProps {
  currentAvatarUrl?: string | null;
  userName?: string | null;
  onAvatarChange: (newAvatarUrl: string) => void;
  isUploading?: boolean;
}

/**
 * Crop, resize, and apply circular mask to image on client-side
 * Returns a 120x120 PNG blob ready for upload
 */
async function processImageOnClient(
  imageSrc: string,
  cropData: CropData
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onload = () => {
      // Create canvas for cropping and resizing
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      if (!ctx) {
        reject(new Error("Failed to get canvas context"));
        return;
      }

      // Set canvas to final output size
      canvas.width = AVATAR_SIZE;
      canvas.height = AVATAR_SIZE;

      // Enable high-quality image rendering
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";

      // Apply circular clipping mask
      ctx.beginPath();
      ctx.arc(AVATAR_SIZE / 2, AVATAR_SIZE / 2, AVATAR_SIZE / 2, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();

      // Draw the cropped portion of the image, scaled to AVATAR_SIZE
      ctx.drawImage(
        img,
        cropData.x,          // Source X
        cropData.y,          // Source Y
        cropData.width,      // Source width
        cropData.height,     // Source height
        0,                   // Destination X
        0,                   // Destination Y
        AVATAR_SIZE,         // Destination width
        AVATAR_SIZE          // Destination height
      );

      // Export as PNG blob
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error("Failed to create image blob"));
          }
        },
        "image/png",
        1.0 // Max quality
      );
    };

    img.onerror = () => {
      reject(new Error("Failed to load image"));
    };

    img.src = imageSrc;
  });
}

export function AvatarUploadSection({
  currentAvatarUrl,
  userName,
  onAvatarChange,
  isUploading: externalUploading,
}: AvatarUploadSectionProps) {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isCropModalOpen, setIsCropModalOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploading = externalUploading || isUploading;

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      setError("Invalid file type. Please upload JPEG, PNG, WebP, or GIF.");
      return;
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      setError("File is too large. Maximum size is 20MB.");
      return;
    }

    setError(null);

    // Read file and open cropper
    const reader = new FileReader();
    reader.onload = (event) => {
      setSelectedImage(event.target?.result as string);
      setIsCropModalOpen(true);
    };
    reader.readAsDataURL(file);
  }, []);

  const handleCropComplete = useCallback(async (cropData: CropData) => {
    if (!selectedImage) return;

    setIsCropModalOpen(false);
    setIsUploading(true);
    setError(null);

    try {
      // Process image on client-side: crop, resize to 120x120, apply circular mask
      const processedBlob = await processImageOnClient(selectedImage, cropData);

      // Create form data with the already processed image
      const formData = new FormData();
      formData.append("file", processedBlob, "avatar.png");

      // Upload to API
      const uploadResponse = await fetch("/api/user/avatar", {
        method: "POST",
        body: formData,
      });

      if (!uploadResponse.ok) {
        const data = await uploadResponse.json();
        throw new Error(data.error || "Failed to upload avatar");
      }

      const result = await uploadResponse.json();
      onAvatarChange(result.avatarUrl);
    } catch (err) {
      console.error("Avatar upload error:", err);
      setError(err instanceof Error ? err.message : "Failed to upload avatar");
    } finally {
      setIsUploading(false);
      setSelectedImage(null);
    }
  }, [selectedImage, onAvatarChange]);

  const handleCropCancel = useCallback(() => {
    setIsCropModalOpen(false);
    setSelectedImage(null);
  }, []);

  const handleAvatarClick = useCallback(() => {
    if (!uploading) {
      fileInputRef.current?.click();
    }
  }, [uploading]);

  return (
    <div className="space-y-4">
      {/* Avatar Preview with Upload Button */}
      <div className="flex items-center gap-6">
        <div className="relative group">
          <button
            type="button"
            onClick={handleAvatarClick}
            disabled={uploading}
            className={cn(
              "relative rounded-full overflow-hidden transition-opacity",
              uploading ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
            )}
          >
            <Avatar
              src={currentAvatarUrl ?? undefined}
              name={userName ?? undefined}
              size="xl"
              className="h-24 w-24"
            />

            {/* Overlay */}
            <div className={cn(
              "absolute inset-0 bg-black/50 flex items-center justify-center transition-opacity",
              uploading ? "opacity-100" : "opacity-0 group-hover:opacity-100"
            )}>
              {uploading ? (
                <Loader2 className="h-6 w-6 text-white animate-spin" />
              ) : (
                <Camera className="h-6 w-6 text-white" />
              )}
            </div>
          </button>
        </div>

        <div className="space-y-2">
          <Button
            variant="outline"
            size="sm"
            leftIcon={Upload}
            onClick={handleAvatarClick}
            disabled={uploading}
            isLoading={uploading}
          >
            {uploading ? "Uploading..." : "Change Photo"}
          </Button>
          <p className="text-xs text-muted-foreground">
            JPEG, PNG, WebP or GIF. Max 20MB.
          </p>
        </div>
      </div>

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={ALLOWED_TYPES.join(",")}
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Error Message */}
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      {/* Crop Modal */}
      <Modal
        isOpen={isCropModalOpen}
        onClose={handleCropCancel}
        title="Crop Your Photo"
        description="Drag to reposition and use the slider to zoom"
        size="md"
      >
        {selectedImage && (
          <ImageCropper
            image={selectedImage}
            onCropComplete={handleCropComplete}
            onCancel={handleCropCancel}
            aspectRatio={1}
            cropShape="round"
            showZoomSlider
          />
        )}
      </Modal>
    </div>
  );
}
