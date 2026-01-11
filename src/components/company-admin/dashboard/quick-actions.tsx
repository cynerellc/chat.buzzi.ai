"use client";

import { motion } from "framer-motion";
import { BookOpen, UserPlus, ArrowRight } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";
import { Card, CardHeader, CardBody } from "@/components/ui";

interface QuickAction {
  label: string;
  description: string;
  href: string;
  icon: React.ElementType;
  gradient: string;
  iconBg: string;
}

const actions: QuickAction[] = [
  {
    label: "Add Knowledge",
    description: "Upload docs & FAQs",
    href: "/knowledge",
    icon: BookOpen,
    gradient: "from-emerald-500/20 to-emerald-600/10",
    iconBg: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  },
  {
    label: "Invite Team",
    description: "Add team members",
    href: "/team",
    icon: UserPlus,
    gradient: "from-amber-500/20 to-amber-600/10",
    iconBg: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  },
];

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
};

export function QuickActions() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <h3 className="font-semibold">Quick Actions</h3>
        <p className="text-sm text-muted-foreground">Get started with common tasks</p>
      </CardHeader>
      <CardBody>
        <motion.div
          className="grid grid-cols-1 sm:grid-cols-2 gap-3"
          variants={containerVariants}
          initial="hidden"
          animate="show"
        >
          {actions.map((action) => {
            const Icon = action.icon;
            return (
              <motion.div key={action.label} variants={itemVariants}>
                <Link
                  href={action.href}
                  className={cn(
                    "group flex items-center gap-3 p-3 rounded-xl transition-all duration-300",
                    "bg-gradient-to-br border border-transparent",
                    action.gradient,
                    "hover:border-primary/20 hover:shadow-md hover:shadow-primary/5",
                    "hover:-translate-y-0.5"
                  )}
                >
                  <div className={cn(
                    "flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-300",
                    action.iconBg,
                    "group-hover:scale-110 group-hover:shadow-lg"
                  )}>
                    <Icon size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm group-hover:text-primary transition-colors">
                      {action.label}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {action.description}
                    </p>
                  </div>
                  <ArrowRight
                    size={14}
                    className="text-muted-foreground opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200"
                  />
                </Link>
              </motion.div>
            );
          })}
        </motion.div>
      </CardBody>
    </Card>
  );
}
