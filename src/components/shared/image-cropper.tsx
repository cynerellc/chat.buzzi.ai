"use client";

import Cropper from "react-easy-crop";
import type { Point, Area } from "react-easy-crop";
import { useCallback, useState } from "react";

import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

export interface CropData {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface ImageCropperProps {
  image: string;
  onCropComplete: (croppedAreaPixels: CropData) => void;
  onCancel: () => void;
  aspectRatio?: number;
  cropShape?: "rect" | "round";
  showZoomSlider?: boolean;
  className?: string;
}

export function ImageCropper({
  image,
  onCropComplete,
  onCancel,
  aspectRatio = 1,
  cropShape = "round",
  showZoomSlider = true,
  className,
}: ImageCropperProps) {
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

  const handleCropComplete = useCallback(
    (_croppedArea: Area, croppedAreaPixels: Area) => {
      setCroppedAreaPixels(croppedAreaPixels);
    },
    []
  );

  const handleConfirm = () => {
    if (croppedAreaPixels) {
      onCropComplete({
        x: croppedAreaPixels.x,
        y: croppedAreaPixels.y,
        width: croppedAreaPixels.width,
        height: croppedAreaPixels.height,
      });
    }
  };

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {/* Cropper Container */}
      <div className="relative w-full h-64 sm:h-80 bg-muted rounded-lg overflow-hidden">
        <Cropper
          image={image}
          crop={crop}
          zoom={zoom}
          aspect={aspectRatio}
          cropShape={cropShape}
          showGrid={false}
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onCropComplete={handleCropComplete}
        />
      </div>

      {/* Zoom Slider */}
      {showZoomSlider && (
        <div className="flex items-center gap-4 px-2">
          <span className="text-sm text-muted-foreground min-w-[50px]">Zoom</span>
          <Slider
            value={[zoom]}
            onValueChange={(values) => setZoom(values[0] ?? 1)}
            min={1}
            max={3}
            step={0.1}
            className="flex-1"
          />
          <span className="text-sm text-muted-foreground min-w-[40px] text-right">
            {Math.round(zoom * 100)}%
          </span>
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={handleConfirm} disabled={!croppedAreaPixels}>
          Apply
        </Button>
      </div>
    </div>
  );
}
