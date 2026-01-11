"use client";

import { motion } from "framer-motion";
import { X, User, Clock, ShieldAlert } from "lucide-react";
import { useState, useEffect } from "react";

import { cn } from "@/lib/utils";
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
      window.location.href = "/admin/dashboard";
    } catch (error) {
      console.error("Failed to end impersonation:", error);
      setIsEnding(false);
    }
  };

  return (
    <motion.div
      initial={{ y: -50, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: -50, opacity: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="fixed top-0 left-0 right-0 z-50"
    >
      <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500 text-white shadow-lg shadow-orange-500/20">
        <div className="max-w-7xl mx-auto px-4 py-2.5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              {/* Animated Icon */}
              <div className="relative">
                <motion.div
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                  className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/20 backdrop-blur-sm"
                >
                  <ShieldAlert size={18} />
                </motion.div>
                <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse" />
              </div>

              {/* Message */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                <span className="text-sm font-semibold">
                  Impersonation Active
                </span>
                <div className="flex items-center gap-2 text-sm">
                  <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white/15 backdrop-blur-sm">
                    <User size={12} />
                    <span className="font-medium">{session.targetUserName}</span>
                  </div>
                  {session.targetUserRole && (
                    <span className="hidden sm:inline opacity-80 text-xs">
                      {session.targetUserRole}
                    </span>
                  )}
                  {duration > 0 && (
                    <div className="flex items-center gap-1 text-xs opacity-80">
                      <Clock size={11} />
                      <span>{duration}m</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* End Button */}
            <Button
              size="sm"
              variant="secondary"
              className={cn(
                "bg-white/20 hover:bg-white/30 text-white border-white/30",
                "backdrop-blur-sm transition-all duration-200",
                "hover:shadow-lg hover:shadow-white/10"
              )}
              onPress={handleEndImpersonation}
              isLoading={isEnding}
            >
              <X size={14} />
              <span className="hidden sm:inline">End Session</span>
            </Button>
          </div>
        </div>

        {/* Progress bar animation */}
        <motion.div
          className="h-0.5 bg-white/30"
          initial={{ scaleX: 0, transformOrigin: "left" }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 60 * 30, ease: "linear" }}
        />
      </div>
    </motion.div>
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
