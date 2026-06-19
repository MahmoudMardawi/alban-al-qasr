interface Props {
  role: "user" | "assistant";
  text: string;
  provider?: "gemini" | "groq";
  thumbnailUrl?: string;
}

export function ChatBubble({ role, text, provider, thumbnailUrl }: Props) {
  const isUser = role === "user";
  return (
    <div className={`flex ${isUser ? "justify-start" : "justify-end"} mb-2`}>
      <div className={`max-w-[80%] rounded-2xl px-3 py-2.5 font-cairo text-sm ${
        isUser
          ? "bg-primary text-white rounded-br-md"
          : "bg-white border border-border text-ink rounded-bl-md"
      }`}>
        {thumbnailUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumbnailUrl} alt="" className="rounded-lg mb-1.5 max-h-24 object-cover" />
        )}
        <div style={{ whiteSpace: "pre-wrap" }}>{text}</div>
        {!isUser && provider && (
          <div className="text-[9px] mt-1 text-muted font-cairo">via {provider}</div>
        )}
      </div>
    </div>
  );
}
