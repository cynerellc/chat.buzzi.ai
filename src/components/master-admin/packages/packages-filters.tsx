"use client";

import { Button } from "@/components/ui";

interface PackagesFiltersProps {
  selectedCategory: string;
  onCategoryChange: (category: string) => void;
}

const categories = [
  { key: "all", label: "All" },
  { key: "support", label: "Support" },
  { key: "sales", label: "Sales" },
  { key: "faq", label: "FAQ" },
  { key: "custom", label: "Custom" },
];

export function PackagesFilters({
  selectedCategory,
  onCategoryChange,
}: PackagesFiltersProps) {
  return (
    <div className="flex flex-wrap gap-4 mb-6">
      {categories.map((category) => (
        <Button
          key={category.key}
          size="sm"
          variant={selectedCategory === category.key ? "default" : "outline"}
          onClick={() => onCategoryChange(category.key)}
        >
          {category.label}
        </Button>
      ))}
    </div>
  );
}
