import { Spinner } from "@/components/ui";

export default function RootLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <Spinner size="lg" />
        <p className="text-muted-foreground text-sm mt-4">Loading...</p>
      </div>
    </div>
  );
}
