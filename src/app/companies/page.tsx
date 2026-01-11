"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Building2, Plus, ChevronRight, Shield, Users } from "lucide-react";

import { Button, Card, Input, Modal, Skeleton } from "@/components/ui";
import { useAuth } from "@/hooks/useAuth";

interface Company {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logoUrl: string | null;
  status: string;
  role: "chatapp.company_admin" | "chatapp.support_agent";
}

export default function CompanySelectionPage() {
  const router = useRouter();
  const { user, isLoading: authLoading, isMasterAdmin } = useAuth();

  const [companies, setCompanies] = useState<Company[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSwitching, setIsSwitching] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Create company modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState("");
  const [newCompanySlug, setNewCompanySlug] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
      return;
    }

    if (user) {
      checkRedirectAndFetchCompanies();
    }
  }, [user, authLoading, router]);

  async function checkRedirectAndFetchCompanies() {
    try {
      // First check if we should auto-redirect
      const redirectResponse = await fetch("/api/auth/redirect");
      if (redirectResponse.ok) {
        const data = await redirectResponse.json();
        // Auto-redirect for active_company or single_company_auto_select
        if (data.reason === "active_company" || data.reason === "single_company_auto_select") {
          router.push(data.redirectUrl);
          return;
        }
        // For master_admin, redirect to admin dashboard
        if (data.reason === "master_admin") {
          router.push(data.redirectUrl);
          return;
        }
      }
    } catch {
      // Continue to fetch companies if redirect check fails
    }

    // If no auto-redirect, fetch companies
    fetchCompanies();
  }

  async function fetchCompanies() {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch("/api/companies");
      if (!response.ok) {
        throw new Error("Failed to fetch companies");
      }

      const data = await response.json();
      setCompanies(data.companies || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSelectCompany(company: Company) {
    try {
      setIsSwitching(company.id);

      const response = await fetch("/api/companies/switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId: company.id }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to switch company");
      }

      const data = await response.json();
      router.push(data.redirectUrl || "/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      setIsSwitching(null);
    }
  }

  async function handleCreateCompany(e: React.FormEvent) {
    e.preventDefault();
    setIsCreating(true);
    setCreateError(null);

    try {
      const response = await fetch("/api/companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newCompanyName,
          slug: newCompanySlug,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to create company");
      }

      await response.json();

      // Close modal and redirect
      setShowCreateModal(false);
      router.push("/dashboard");
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsCreating(false);
    }
  }

  // Auto-generate slug from company name
  function handleNameChange(name: string) {
    setNewCompanyName(name);
    // Generate slug: lowercase, replace spaces with hyphens, remove special chars
    const slug = name
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "")
      .substring(0, 50);
    setNewCompanySlug(slug);
  }

  function getRoleDisplay(role: string) {
    switch (role) {
      case "chatapp.company_admin":
        return { label: "Admin", icon: Shield, color: "text-primary" };
      case "chatapp.support_agent":
        return { label: "Agent", icon: Users, color: "text-secondary" };
      default:
        return { label: "Member", icon: Users, color: "text-muted-foreground" };
    }
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
            <Building2 className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold mb-2">Select a Company</h1>
          <p className="text-muted-foreground">
            Choose a company to continue to your dashboard
          </p>
        </div>

        {/* Error message */}
        {error && (
          <div className="mb-6 p-4 bg-danger/10 border border-danger/20 rounded-lg text-danger text-center">
            {error}
          </div>
        )}

        {/* Loading state */}
        {isLoading && (
          <div className="grid gap-4 md:grid-cols-2">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-32 rounded-lg" />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!isLoading && companies.length === 0 && (
          <Card className="p-8 text-center">
            <Building2 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">No companies yet</h2>
            <p className="text-muted-foreground mb-6">
              Create your first company to get started with the chat platform
            </p>
            <Button color="primary" onClick={() => setShowCreateModal(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Create Company
            </Button>
          </Card>
        )}

        {/* Companies grid */}
        {!isLoading && companies.length > 0 && (
          <>
            <div className="grid gap-4 md:grid-cols-2">
              {companies.map((company) => {
                const roleInfo = getRoleDisplay(company.role);
                const RoleIcon = roleInfo.icon;
                const isActive = isSwitching === company.id;

                return (
                  <Card
                    key={company.id}
                    className={`p-4 cursor-pointer transition-all hover:border-primary/50 hover:shadow-md ${
                      isActive ? "border-primary bg-primary/5" : ""
                    }`}
                    onClick={() => !isSwitching && handleSelectCompany(company)}
                  >
                    <div className="flex items-center gap-4">
                      {/* Company logo/icon */}
                      <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                        {company.logoUrl ? (
                          <img
                            src={company.logoUrl}
                            alt={company.name}
                            className="w-10 h-10 rounded-md object-cover"
                          />
                        ) : (
                          <Building2 className="w-6 h-6 text-primary" />
                        )}
                      </div>

                      {/* Company info */}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold truncate">{company.name}</h3>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <RoleIcon className={`w-4 h-4 ${roleInfo.color}`} />
                          <span>{roleInfo.label}</span>
                        </div>
                      </div>

                      {/* Arrow */}
                      <div className="flex-shrink-0">
                        {isActive ? (
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary" />
                        ) : (
                          <ChevronRight className="w-5 h-5 text-muted-foreground" />
                        )}
                      </div>
                    </div>

                    {company.description && (
                      <p className="mt-3 text-sm text-muted-foreground line-clamp-2">
                        {company.description}
                      </p>
                    )}
                  </Card>
                );
              })}
            </div>

            {/* Create company button */}
            <div className="mt-6 text-center">
              <Button
                variant="outline"
                onClick={() => setShowCreateModal(true)}
              >
                <Plus className="w-4 h-4 mr-2" />
                Create New Company
              </Button>
            </div>
          </>
        )}

        {/* Master admin link */}
        {isMasterAdmin && (
          <div className="mt-8 text-center">
            <Button
              variant="ghost"
              onClick={() => router.push("/admin/dashboard")}
            >
              <Shield className="w-4 h-4 mr-2" />
              Go to Admin Dashboard
            </Button>
          </div>
        )}

        {/* Create Company Modal */}
        <Modal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          title="Create New Company"
        >
          <form onSubmit={handleCreateCompany} className="space-y-4">
            {createError && (
              <div className="p-3 bg-danger/10 border border-danger/20 rounded-lg text-danger text-sm">
                {createError}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium mb-1">
                Company Name
              </label>
              <Input
                value={newCompanyName}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="My Company"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Company Slug
              </label>
              <Input
                value={newCompanySlug}
                onChange={(e) => setNewCompanySlug(e.target.value)}
                placeholder="my-company"
                pattern="^[a-z0-9-]+$"
                required
              />
              <p className="text-xs text-muted-foreground mt-1">
                Lowercase letters, numbers, and hyphens only
              </p>
            </div>

            <div className="flex gap-3 justify-end pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowCreateModal(false)}
                disabled={isCreating}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                color="primary"
                disabled={isCreating || !newCompanyName || !newCompanySlug}
              >
                {isCreating ? "Creating..." : "Create Company"}
              </Button>
            </div>
          </form>
        </Modal>
      </div>
    </div>
  );
}
