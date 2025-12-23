import { Spinner } from "@heroui/react";

export default function RootLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <Spinner size="lg" />
        <p className="text-default-500 text-sm mt-4">Loading...</p>
      </div>
    </div>
  );
}
