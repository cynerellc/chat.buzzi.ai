"use client";

import { motion } from "framer-motion";
import { Bot, MessageSquare, Sparkles, ArrowRight } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";
import { Avatar, Button, Card, CardHeader, CardBody, Skeleton } from "@/components/ui";
import type { AgentOverview } from "@/hooks/company";

interface AgentsOverviewProps {
  agents: AgentOverview[];
  isLoading?: boolean;
}

const statusConfig = {
  active: { variant: "success" as const, label: "Active", dot: "bg-success", bg: "bg-success/10" },
  paused: { variant: "warning" as const, label: "Paused", dot: "bg-warning", bg: "bg-warning/10" },
  draft: { variant: "default" as const, label: "Draft", dot: "bg-muted-foreground", bg: "bg-muted" },
};

function AgentCard({ agent, index }: { agent: AgentOverview; index: number }) {
  const config = statusConfig[agent.status] || statusConfig.draft;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
    >
      <Link href={`/chatbots/${agent.id}`}>
        <Card className="group p-5 hover:shadow-lg hover:shadow-primary/5 hover:border-primary/30 transition-all duration-300 cursor-pointer h-full">
          <div className="flex flex-col items-center text-center">
            <div className="relative mb-4">
              <div className={cn(
                "w-16 h-16 rounded-2xl flex items-center justify-center transition-all duration-300",
                "bg-gradient-to-br from-primary/15 to-primary/5",
                "group-hover:shadow-lg group-hover:shadow-primary/20 group-hover:scale-105"
              )}>
                {agent.avatarUrl ? (
                  <Avatar
                    src={agent.avatarUrl}
                    name={agent.name}
                    size="lg"
                    className="w-16 h-16 rounded-2xl"
                  />
                ) : (
                  <Bot className="w-7 h-7 text-primary" />
                )}
              </div>
              {agent.status === "active" && (
                <span className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full bg-success border-2 border-card" />
              )}
            </div>

            <h4 className="font-semibold truncate w-full group-hover:text-primary transition-colors">{agent.name}</h4>

            <div className={cn(
              "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium mt-2",
              config.bg
            )}>
              <span className={cn("h-1.5 w-1.5 rounded-full", config.dot, agent.status === "active" && "animate-pulse")} />
              {config.label}
            </div>

            <div className="mt-4 w-full grid grid-cols-2 gap-2">
              <div className="p-2 rounded-lg bg-muted/50">
                <div className="flex items-center justify-center gap-1 text-muted-foreground mb-0.5">
                  <MessageSquare size={10} />
                  <span className="text-[10px]">Today</span>
                </div>
                <p className="text-sm font-semibold">{agent.todayConversations}</p>
              </div>
              <div className="p-2 rounded-lg bg-muted/50">
                <div className="flex items-center justify-center gap-1 text-muted-foreground mb-0.5">
                  <Sparkles size={10} />
                  <span className="text-[10px]">AI Rate</span>
                </div>
                <p className="text-sm font-semibold">{agent.aiResolutionRate}%</p>
              </div>
            </div>
          </div>
        </Card>
      </Link>
    </motion.div>
  );
}

export function AgentsOverview({ agents, isLoading }: AgentsOverviewProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between w-full">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-8 w-28" />
          </div>
        </CardHeader>
        <CardBody className="pt-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-56 rounded-xl" />
            ))}
          </div>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between w-full">
          <div>
            <h3 className="font-semibold">Your Chatbots</h3>
            <p className="text-sm text-muted-foreground">AI assistants handling conversations</p>
          </div>
          <Button asChild variant="ghost" size="sm" className="group">
            <Link href="/chatbots" className="flex items-center gap-1">
              Manage
              <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardBody className="pt-0">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {agents.map((agent, index) => (
            <AgentCard key={agent.id} agent={agent} index={index} />
          ))}
        </div>
      </CardBody>
    </Card>
  );
}
