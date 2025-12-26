"use client";

import {
  User as UserIcon,
  Mail,
  Phone,
  Globe,
  MapPin,
  Clock,
  MessageSquare,
  Calendar,
  Bot,
  Tag,
  ExternalLink,
} from "lucide-react";

import { Button, Card, CardBody, Badge, Chip } from "@/components/ui";
import type { ConversationDetail } from "@/app/api/company/conversations/[conversationId]/route";

interface CustomerSidebarProps {
  conversation: ConversationDetail;
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function CustomerSidebar({ conversation }: CustomerSidebarProps) {
  const { endUser, agent, tags } = conversation;
  const location = endUser.location as { country?: string; city?: string; timezone?: string };

  return (
    <div className="w-80 border-l border-divider bg-background overflow-y-auto">
      <div className="p-4 space-y-6">
        {/* Customer Profile */}
        <div className="text-center">
          <div className="flex h-16 w-16 mx-auto items-center justify-center rounded-full bg-primary/10 mb-3">
            {endUser.avatarUrl ? (
              <img
                src={endUser.avatarUrl}
                alt=""
                className="h-16 w-16 rounded-full object-cover"
              />
            ) : (
              <UserIcon className="h-8 w-8 text-primary" />
            )}
          </div>
          <h3 className="font-semibold text-lg">
            {endUser.name || "Anonymous"}
          </h3>
          {endUser.email && (
            <p className="text-sm text-default-500">{endUser.email}</p>
          )}
        </div>

        {/* Contact Info */}
        <Card>
          <CardBody className="space-y-3">
            <h4 className="font-medium text-sm text-default-500 uppercase tracking-wider">
              Contact Info
            </h4>

            {endUser.email && (
              <div className="flex items-center gap-3 text-sm">
                <Mail className="h-4 w-4 text-default-400" />
                <a
                  href={`mailto:${endUser.email}`}
                  className="text-primary hover:underline truncate"
                >
                  {endUser.email}
                </a>
              </div>
            )}

            {endUser.phone && (
              <div className="flex items-center gap-3 text-sm">
                <Phone className="h-4 w-4 text-default-400" />
                <a
                  href={`tel:${endUser.phone}`}
                  className="text-primary hover:underline"
                >
                  {endUser.phone}
                </a>
              </div>
            )}

            <div className="flex items-center gap-3 text-sm">
              <Globe className="h-4 w-4 text-default-400" />
              <span className="capitalize">{endUser.channel}</span>
            </div>

            {(location.country || location.city) && (
              <div className="flex items-center gap-3 text-sm">
                <MapPin className="h-4 w-4 text-default-400" />
                <span>
                  {[location.city, location.country].filter(Boolean).join(", ")}
                </span>
              </div>
            )}
          </CardBody>
        </Card>

        {/* Customer Stats */}
        <Card>
          <CardBody className="space-y-3">
            <h4 className="font-medium text-sm text-default-500 uppercase tracking-wider">
              Customer Stats
            </h4>

            <div className="flex items-center gap-3 text-sm">
              <MessageSquare className="h-4 w-4 text-default-400" />
              <span>{endUser.totalConversations} total conversations</span>
            </div>

            <div className="flex items-center gap-3 text-sm">
              <Calendar className="h-4 w-4 text-default-400" />
              <span>Customer since {formatDate(endUser.createdAt)}</span>
            </div>

            {endUser.lastSeenAt && (
              <div className="flex items-center gap-3 text-sm">
                <Clock className="h-4 w-4 text-default-400" />
                <span>Last seen {formatDate(endUser.lastSeenAt)}</span>
              </div>
            )}
          </CardBody>
        </Card>

        {/* Current Conversation */}
        <Card>
          <CardBody className="space-y-3">
            <h4 className="font-medium text-sm text-default-500 uppercase tracking-wider">
              This Conversation
            </h4>

            <div className="flex items-center gap-3 text-sm">
              <Bot className="h-4 w-4 text-default-400" />
              <span>
                Agent: <strong>{agent.name}</strong>
              </span>
            </div>

            <div className="flex items-center gap-3 text-sm">
              <MessageSquare className="h-4 w-4 text-default-400" />
              <span>{conversation.messageCount} messages</span>
            </div>

            <div className="flex items-center gap-3 text-sm">
              <Calendar className="h-4 w-4 text-default-400" />
              <span>Started {formatDate(conversation.createdAt)}</span>
            </div>

            {conversation.pageUrl && (
              <div className="flex items-start gap-3 text-sm">
                <ExternalLink className="h-4 w-4 text-default-400 shrink-0 mt-0.5" />
                <a
                  href={conversation.pageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline truncate"
                >
                  {conversation.pageUrl}
                </a>
              </div>
            )}

            {conversation.sentiment !== null && (
              <div className="flex items-center gap-3 text-sm">
                <span className="text-default-400">Sentiment:</span>
                <Badge
                  variant={
                    conversation.sentiment > 30
                      ? "success"
                      : conversation.sentiment < -30
                        ? "danger"
                        : "default"
                  }
                >
                  {conversation.sentiment > 30
                    ? "Positive"
                    : conversation.sentiment < -30
                      ? "Negative"
                      : "Neutral"}
                </Badge>
              </div>
            )}

            {conversation.satisfactionRating && (
              <div className="flex items-center gap-3 text-sm">
                <span className="text-default-400">Rating:</span>
                <span>{"⭐".repeat(conversation.satisfactionRating)}</span>
              </div>
            )}
          </CardBody>
        </Card>

        {/* Tags */}
        {tags.length > 0 && (
          <Card>
            <CardBody className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-sm text-default-500 uppercase tracking-wider">
                  Tags
                </h4>
                <Button variant="ghost" size="icon" disabled>
                  <Tag className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <Chip key={tag}  size="sm">
                    {tag}
                  </Chip>
                ))}
              </div>
            </CardBody>
          </Card>
        )}

        {/* Escalation Info */}
        {conversation.escalation && (
          <Card>
            <CardBody className="space-y-3">
              <h4 className="font-medium text-sm text-default-500 uppercase tracking-wider">
                Escalation
              </h4>
              <div className="text-sm space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-default-500">Status:</span>
                  <Badge
                    variant={
                      conversation.escalation.status === "resolved"
                        ? "success"
                        : conversation.escalation.status === "pending"
                          ? "warning"
                          : "info"
                    }
                  >
                    {conversation.escalation.status}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-default-500">Priority:</span>
                  <Badge
                    variant={
                      conversation.escalation.priority === "urgent"
                        ? "danger"
                        : conversation.escalation.priority === "high"
                          ? "warning"
                          : "default"
                    }
                  >
                    {conversation.escalation.priority}
                  </Badge>
                </div>
                {conversation.escalation.reason && (
                  <div>
                    <span className="text-default-500">Reason:</span>
                    <p className="text-foreground mt-1">
                      {conversation.escalation.reason}
                    </p>
                  </div>
                )}
              </div>
            </CardBody>
          </Card>
        )}
      </div>
    </div>
  );
}
