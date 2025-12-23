"use client";

import { AlertTriangle, X } from "lucide-react";
import { useState, useEffect } from "react";

import { Button } from "@/components/ui";
import {
  useImpersonation,
  endImpersonation,
  type ImpersonationSession,
} from "@/hooks/master-admin";

interface ImpersonationBannerProps {
  session: ImpersonationSession;
  onEnd: () => void;
}

function BannerContent({ session, onEnd }: ImpersonationBannerProps) {
  const [isEnding, setIsEnding] = useState(false);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const startTime = new Date(session.startedAt).getTime();
    const updateDuration = () => {
      setDuration(Math.floor((Date.now() - startTime) / 60000));
    };
    updateDuration();
    const interval = setInterval(updateDuration, 60000);
    return () => clearInterval(interval);
  }, [session.startedAt]);

  const handleEndImpersonation = async () => {
    setIsEnding(true);
    try {
      await endImpersonation();
      onEnd();
      // Redirect back to admin
      window.location.href = "/admin/dashboard";
    } catch (error) {
      console.error("Failed to end impersonation:", error);
      setIsEnding(false);
    }
  };

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-warning-500 text-warning-foreground px-4 py-2">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <AlertTriangle size={18} />
          <span className="text-sm font-medium">
            You are impersonating{" "}
            <strong>{session.targetUserName}</strong>
            {session.targetUserRole && (
              <span className="opacity-80"> ({session.targetUserRole})</span>
            )}
            {duration > 0 && (
              <span className="opacity-80 ml-2">• {duration}m</span>
            )}
          </span>
        </div>
        <Button
          size="sm"
          variant="flat"
          className="bg-warning-600 text-white hover:bg-warning-700"
          startContent={<X size={14} />}
          onPress={handleEndImpersonation}
          isLoading={isEnding}
        >
          End Session
        </Button>
      </div>
    </div>
  );
}

/**
 * Banner that shows when a master admin is impersonating a user
 * Should be placed in the root layout
 */
export function ImpersonationBanner() {
  const { isImpersonating, session, mutate } = useImpersonation();

  if (!isImpersonating || !session) {
    return null;
  }

  return <BannerContent session={session} onEnd={mutate} />;
}
