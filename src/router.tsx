import { QueryCache, MutationCache, QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { toast } from "sonner";

function isUnauthorizedError(error: unknown): boolean {
  if (!error) return false;
  const msg =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "";
  if (/unauthorized/i.test(msg) || /\b401\b/.test(msg)) return true;
  const status = (error as { status?: number; statusCode?: number })?.status
    ?? (error as { statusCode?: number })?.statusCode;
  return status === 401;
}

function handleGlobalError(error: unknown) {
  if (isUnauthorizedError(error)) {
    toast.error("เซสชันหมดอายุ", {
      description: "กรุณาเข้าสู่ระบบใหม่เพื่อดำเนินการต่อ",
      id: "auth-401",
      action: {
        label: "เข้าสู่ระบบ",
        onClick: () => {
          window.location.href = "/auth";
        },
      },
    });
    return;
  }
  console.error(error);
  toast.error("เกิดข้อผิดพลาด", {
    description:
      error instanceof Error ? error.message : "ลองอีกครั้งภายหลัง",
  });
}

export const getRouter = () => {
  const queryClient = new QueryClient({
    queryCache: new QueryCache({ onError: handleGlobalError }),
    mutationCache: new MutationCache({ onError: handleGlobalError }),
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    defaultErrorComponent: ({ error, reset }) => {
      const unauthorized = isUnauthorizedError(error);
      return (
        <div className="flex min-h-screen items-center justify-center bg-background px-4">
          <div className="max-w-md text-center">
            <h1 className="text-xl font-semibold tracking-tight text-foreground">
              {unauthorized ? "ต้องเข้าสู่ระบบ" : "เกิดข้อผิดพลาด"}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {unauthorized
                ? "เซสชันของคุณหมดอายุ กรุณาเข้าสู่ระบบใหม่"
                : error instanceof Error
                  ? error.message
                  : "ลองรีเฟรชหรือกลับหน้าแรก"}
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              {unauthorized ? (
                <a
                  href="/auth"
                  className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  เข้าสู่ระบบ
                </a>
              ) : (
                <button
                  onClick={() => reset()}
                  className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  ลองอีกครั้ง
                </button>
              )}
              <a
                href="/"
                className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
              >
                กลับหน้าแรก
              </a>
            </div>
          </div>
        </div>
      );
    },
  });

  return router;
};
