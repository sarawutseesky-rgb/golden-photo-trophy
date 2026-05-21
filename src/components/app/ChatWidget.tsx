import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { MessageCircle, X, Send, Trash2 } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import {
  listChatMessages,
  sendChatMessage,
  deleteChatMessage,
  type ChatMessage,
} from "@/lib/chat.functions";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

function formatTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diff = (now.getTime() - d.getTime()) / 1000;
  if (diff < 60) return "เมื่อสักครู่";
  if (diff < 3600) return `${Math.floor(diff / 60)} นาทีที่แล้ว`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} ชม.ที่แล้ว`;
  return d.toLocaleDateString("th-TH", { day: "numeric", month: "short" });
}

export function ChatWidget() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const qc = useQueryClient();

  const list = useServerFn(listChatMessages);
  const send = useServerFn(sendChatMessage);
  const del = useServerFn(deleteChatMessage);

  const { data, isLoading } = useQuery({
    queryKey: ["chat-messages"],
    queryFn: () => list({ data: { limit: 50 } }),
    enabled: open,
    staleTime: 10_000,
  });

  const messages: ChatMessage[] = data?.messages ?? [];

  // Realtime subscription
  useEffect(() => {
    if (!open) return;
    const channel = supabase
      .channel("chat-messages-rt")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages" },
        () => {
          qc.invalidateQueries({ queryKey: ["chat-messages"] });
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "chat_messages" },
        () => {
          qc.invalidateQueries({ queryKey: ["chat-messages"] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [open, qc]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (open && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length, open]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const content = input.trim();
    if (!content || sending) return;
    setSending(true);
    try {
      await send({ data: { content } });
      setInput("");
      qc.invalidateQueries({ queryKey: ["chat-messages"] });
    } catch (err: any) {
      toast.error(err?.message || "ส่งข้อความไม่สำเร็จ");
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await del({ data: { id } });
      qc.invalidateQueries({ queryKey: ["chat-messages"] });
    } catch (err: any) {
      toast.error(err?.message || "ลบไม่สำเร็จ");
    }
  };

  return (
    <>
      {/* Floating toggle button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="เปิดห้องแชต"
          className="fixed bottom-4 right-4 z-50 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:scale-105 transition-transform flex items-center justify-center"
        >
          <MessageCircle className="h-6 w-6" />
        </button>
      )}

      {/* Chat panel */}
      {open && (
        <div
          className={cn(
            "fixed bottom-4 right-4 z-50 w-[min(380px,calc(100vw-2rem))] h-[min(560px,calc(100vh-2rem))]",
            "rounded-xl border border-border bg-card text-card-foreground shadow-2xl",
            "flex flex-col overflow-hidden",
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/40">
            <div className="flex items-center gap-2">
              <MessageCircle className="h-4 w-4 text-primary" />
              <h3 className="font-semibold text-sm">ห้องแชตสมาชิก</h3>
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label="ปิด"
              className="h-7 w-7 rounded-md hover:bg-muted flex items-center justify-center"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
            {isLoading && (
              <p className="text-center text-xs text-muted-foreground">กำลังโหลด…</p>
            )}
            {!isLoading && messages.length === 0 && (
              <p className="text-center text-xs text-muted-foreground py-8">
                ยังไม่มีข้อความ — เริ่มทักทายกันได้เลย!
              </p>
            )}
            {messages.map((m) => {
              const isMe = user?.id === m.user_id;
              const name = m.profile?.display_name || "Member";
              return (
                <div key={m.id} className={cn("flex gap-2", isMe && "flex-row-reverse")}>
                  <Avatar className="h-7 w-7 flex-shrink-0">
                    <AvatarImage src={m.profile?.avatar_url ?? undefined} />
                    <AvatarFallback className="text-[10px]">
                      {name.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className={cn("flex flex-col gap-0.5 max-w-[75%]", isMe && "items-end")}>
                    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                      <span className="font-medium">{name}</span>
                      <span>·</span>
                      <span>{formatTime(m.created_at)}</span>
                    </div>
                    <div
                      className={cn(
                        "rounded-2xl px-3 py-1.5 text-sm break-words",
                        isMe
                          ? "bg-primary text-primary-foreground rounded-br-sm"
                          : "bg-muted text-foreground rounded-bl-sm",
                      )}
                    >
                      {m.content}
                    </div>
                    {isMe && (
                      <button
                        onClick={() => handleDelete(m.id)}
                        className="text-[10px] text-muted-foreground hover:text-destructive flex items-center gap-1"
                      >
                        <Trash2 className="h-3 w-3" /> ลบ
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Composer */}
          <div className="border-t border-border p-2">
            {user ? (
              <form onSubmit={handleSend} className="flex gap-2 items-end">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSend(e as any);
                    }
                  }}
                  placeholder="พิมพ์ข้อความ…"
                  rows={1}
                  maxLength={500}
                  className="flex-1 resize-none rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring max-h-24"
                />
                <Button
                  type="submit"
                  size="icon"
                  disabled={!input.trim() || sending}
                  aria-label="ส่ง"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            ) : (
              <div className="text-center text-xs text-muted-foreground py-2">
                <Link to="/login" className="text-primary hover:underline font-medium">
                  เข้าสู่ระบบ
                </Link>{" "}
                เพื่อร่วมพูดคุยกับสมาชิก
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}