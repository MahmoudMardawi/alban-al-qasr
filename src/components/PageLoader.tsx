import { Spinner } from "./Spinner";

export function PageLoader({ label = "جارٍ التحميل..." }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4 py-12">
      <Spinner size={36} className="text-primary" />
      <p className="font-cairo text-sm text-muted">{label}</p>
    </div>
  );
}
