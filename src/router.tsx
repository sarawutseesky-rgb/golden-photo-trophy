import {
  QueryCache,
  MutationCache,
  QueryClient,
  type Mutation,
} from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

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

let refreshing = false;
let lastFailedMutation:
  | { mutation: Mutation<unknown, unknown, unknown, unknown>; variables: unknown }
  | null = null;

function retryLastFailedMutation() {
  if (!lastFailedMutation) {
    toast.info("ไม่มีคำขอที่ค้างให้รีลอง");
    return;
  }
  const { mutation, variables } = lastFailedMutation;
  lastFailedMutation = null;
  const toastId = "retry-mutation";
  toast.loading("กำลังรีลองคำขอ...", { id: toastId });
  mutation
    .execute(variables as never)
    .then(() => toast.success("คำขอสำเร็จ", { id: toastId }))
    .catch((e) =>
      toast.error("รีลองไม่สำเร็จ", {
        id: toastId,
        description: e instanceof Error ? e.message : undefined,
      }),
    );
}

async function tryRefreshSession(
  queryClient: QueryClient,
): Promise<boolean> {
  if (refreshing) return false;
  refreshing = true;
  const toastId = "auth-refresh";
  toast.loading("กำลังรีเฟรชเซสชัน...", { id: toastId });
  try {
    const { data, error } = await supabase.auth.refreshSession();
    if (error || !data.session) {
      toast.error("รีเฟรชเซสชันไม่สำเร็จ", {
        id: toastId,
        description: "กรุณาเข้าสู่ระบบใหม่",
        action: {
          label: "เข้าสู่ระบบ",
          onClick: () => {
            window.location.href = "/login";
          },
        },
      });
      return false;
    }
    toast.success("รีเฟรชเซสชันสำเร็จ", { id: toastId });
    await queryClient.invalidateQueries();
    if (lastFailedMutation) {
      toast("พบคำขอค้างอยู่", {
        id: "retry-prompt",
        description: "กดเพื่อส่งคำขอเดิมอีกครั้ง",
        duration: 10000,
        action: {
          label: "รีลองคำขอ",
          onClick: () => retryLastFailedMutation(),
        },
      });
    }
    return true;
  } catch (e) {
    toast.error("รีเฟรชเซสชันไม่สำเร็จ", {
      id: toastId,
      description: e instanceof Error ? e.message : undefined,
    });
    return false;
  } finally {
    refreshing = false;
  }
}

function makeErrorHandler(queryClient: QueryClient) {
  return (error: unknown, _v?: unknown, _c?: unknown, mutation?: Mutation<unknown, unknown, unknown, unknown>) => {
  if (isUnauthorizedError(error)) {
    if (mutation) {
      lastFailedMutation = { mutation, variables: mutation.state.variables };
    }
    toast.error("เซสชันหมดอายุ", {
        description: "ลองรีเฟรชเซสชัน หรือเข้าสู่ระบบใหม่",
      id: "auth-401",
        duration: 10000,
      action: {
          label: "รีเฟรชเซสชัน",
          onClick: () => {
            void tryRefreshSession(queryClient);
          },
      },
        cancel: {
          label: "เข้าสู่ระบบ",
          onClick: () => {
            window.location.href = "/login";
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
  };
}

export const getRouter = () => {
  let queryClient: QueryClient;
  const onError = (error: unknown) => makeErrorHandler(queryClient)(error);
  const onMutationError = (
    error: unknown,
    variables: unknown,
    context: unknown,
    mutation: Mutation<unknown, unknown, unknown, unknown>,
  ) => makeErrorHandler(queryClient)(error, variables, context, mutation);
  queryClient = new QueryClient({
    queryCache: new QueryCache({ onError }),
    mutationCache: new MutationCache({ onError: onMutationError }),
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
                ? "เซสชันของคุณหมดอายุ ลองรีเฟรชเซสชันก่อนเข้าสู่ระบบใหม่"
                : error instanceof Error
                  ? error.message
                  : "ลองรีเฟรชหรือกลับหน้าแรก"}
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              {unauthorized ? (
                <>
                  <button
                    onClick={async () => {
                      const ok = await tryRefreshSession(queryClient);
                      if (ok) reset();
                    }}
                    className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                  >
                    รีเฟรชเซสชัน
                  </button>
                  <a
                    href="/login"
                    className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
                  >
                    เข้าสู่ระบบ
                  </a>
                </>
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
