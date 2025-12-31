import { MessageSquare, Sparkles, Users } from "lucide-react";
import Link from "next/link";

import { Button, Card, CardBody } from "@/components/ui";

// M1: Force static generation for marketing page
export const dynamic = "force-static";
export const revalidate = 86400; // Revalidate daily for copyright year

export default function HomePage() {
  return (
    <main className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <span className="text-xl font-bold">Chat.buzzi.ai</span>
          <Link
            href="/login"
            className="text-sm font-medium text-primary hover:underline"
          >
            Login
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-secondary/10" />
        <div className="container mx-auto px-4 py-24">
          <div className="text-center">
            <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
              <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                Chat.buzzi.ai
              </span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
              Multi-Tenant AI Customer Support Platform. Deploy intelligent
              chatbots with knowledge base integration, human-in-the-loop
              support, and real-time analytics.
            </p>
            <div className="mt-10 flex items-center justify-center gap-4">
              <Button color="primary" size="lg" className="font-semibold" asChild>
                <Link href="/login">Get Started</Link>
              </Button>
              <Button variant="outline" size="lg" className="font-semibold" asChild>
                <Link href="/register">Create Account</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="container mx-auto px-4 py-24">
        <div className="grid gap-8 md:grid-cols-3">
          <Card className="bg-content1">
            <CardBody className="gap-4 p-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                <Sparkles className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold">AI-Powered Responses</h3>
              <p className="text-muted-foreground">
                Intelligent chatbots powered by advanced LLMs with RAG-based
                knowledge retrieval for accurate responses.
              </p>
            </CardBody>
          </Card>

          <Card className="bg-content1">
            <CardBody className="gap-4 p-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold">Multi-Tenant Platform</h3>
              <p className="text-muted-foreground">
                Complete tenant isolation with customizable agents, knowledge
                bases, and team management per company.
              </p>
            </CardBody>
          </Card>

          <Card className="bg-content1">
            <CardBody className="gap-4 p-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                <MessageSquare className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold">Human-in-the-Loop</h3>
              <p className="text-muted-foreground">
                Seamless escalation to human agents with real-time handover and
                co-pilot assistance.
              </p>
            </CardBody>
          </Card>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-border py-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} Buzzi.ai. All rights reserved.</p>
        </div>
      </footer>
    </main>
  );
}
