import { useState } from "react";
import { MessageSquarePlus, Check, Pencil, Trash2, X } from "lucide-react";
import type { InlineComment, InlineCommentSide } from "../../types";
import { useReviewStore } from "../../stores/useReviewStore";

interface DiffLine {
  type: "added" | "removed" | "context" | "header";
  content: string;
  oldLineNo: number | null;
  newLineNo: number | null;
}

function parseDiffLines(diffText: string): DiffLine[] {
  const rawLines = diffText.split("\n");
  const lines: DiffLine[] = [];
  let oldLine = 0;
  let newLine = 0;

  for (const raw of rawLines) {
    if (raw.startsWith("@@")) {
      const match = raw.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
      if (match) {
        oldLine = parseInt(match[1], 10);
        newLine = parseInt(match[2], 10);
      }
      lines.push({ type: "header", content: raw, oldLineNo: null, newLineNo: null });
    } else if (raw.startsWith("+")) {
      lines.push({ type: "added", content: raw.slice(1), oldLineNo: null, newLineNo: newLine });
      newLine++;
    } else if (raw.startsWith("-")) {
      lines.push({ type: "removed", content: raw.slice(1), oldLineNo: oldLine, newLineNo: null });
      oldLine++;
    } else if (raw.startsWith(" ")) {
      lines.push({ type: "context", content: raw.slice(1), oldLineNo: oldLine, newLineNo: newLine });
      oldLine++;
      newLine++;
    } else if (
      raw.startsWith("diff ") ||
      raw.startsWith("index ") ||
      raw.startsWith("---") ||
      raw.startsWith("+++")
    ) {
      lines.push({ type: "header", content: raw, oldLineNo: null, newLineNo: null });
    }
  }

  return lines;
}

const lineColors: Record<DiffLine["type"], string> = {
  added: "bg-green-950/40 text-green-300",
  removed: "bg-red-950/40 text-red-300",
  context: "text-zinc-400",
  header: "bg-zinc-800/50 text-indigo-400",
};

interface AnchorKey {
  side: InlineCommentSide;
  lineNumber: number;
}

function preferredAnchor(line: DiffLine): AnchorKey | null {
  if (line.type === "added" && line.newLineNo != null) {
    return { side: "new", lineNumber: line.newLineNo };
  }
  if (line.type === "removed" && line.oldLineNo != null) {
    return { side: "old", lineNumber: line.oldLineNo };
  }
  if (line.type === "context" && line.newLineNo != null) {
    return { side: "new", lineNumber: line.newLineNo };
  }
  return null;
}

interface CommentBubbleProps {
  comment: InlineComment;
  onEdit: (body: string) => Promise<void>;
  onDelete: () => Promise<void>;
  onResolve: () => Promise<void>;
}

function CommentBubble({ comment, onEdit, onDelete, onResolve }: CommentBubbleProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(comment.body);
  const [busy, setBusy] = useState(false);

  const isResolved = comment.status === "resolved";
  const isShipped = comment.status === "shipped";
  const isDraft = comment.status === "draft";

  const save = async () => {
    if (!draft.trim() || draft === comment.body) {
      setEditing(false);
      return;
    }
    setBusy(true);
    try {
      await onEdit(draft);
      setEditing(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className={`my-1 mx-2 px-2 py-1.5 rounded border text-xs ${
        isResolved
          ? "border-zinc-800 bg-zinc-950/60 text-zinc-500"
          : isShipped
            ? "border-indigo-900 bg-indigo-950/30 text-zinc-300"
            : "border-amber-900 bg-amber-950/20 text-zinc-200"
      }`}
    >
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider opacity-80 mb-0.5">
        <span>
          {isResolved ? "Resolved" : isShipped ? "Shipped" : "Draft"}
        </span>
        <span className="ml-auto flex items-center gap-1">
          {isDraft && !editing && (
            <button
              onClick={() => setEditing(true)}
              disabled={busy}
              className="p-0.5 hover:text-zinc-100"
              title="Edit"
            >
              <Pencil size={11} />
            </button>
          )}
          {isDraft && (
            <button
              onClick={() => onDelete()}
              disabled={busy}
              className="p-0.5 hover:text-red-400"
              title="Delete"
            >
              <Trash2 size={11} />
            </button>
          )}
          {!isDraft && !isResolved && (
            <button
              onClick={() => onResolve()}
              disabled={busy}
              className="p-0.5 hover:text-emerald-400"
              title="Mark resolved"
            >
              <Check size={11} />
            </button>
          )}
        </span>
      </div>

      {editing ? (
        <div className="flex flex-col gap-1.5">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={3}
            autoFocus
            className="w-full bg-zinc-900 border border-zinc-700 rounded p-1.5 text-xs text-zinc-100 font-sans"
          />
          <div className="flex justify-end gap-1.5">
            <button
              onClick={() => {
                setDraft(comment.body);
                setEditing(false);
              }}
              className="px-2 py-0.5 text-[11px] text-zinc-400 hover:text-zinc-100"
            >
              Cancel
            </button>
            <button
              onClick={save}
              disabled={busy || !draft.trim()}
              className="px-2 py-0.5 text-[11px] bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-900 text-white rounded"
            >
              Save
            </button>
          </div>
        </div>
      ) : (
        <div className={`whitespace-pre-wrap font-sans ${isResolved ? "line-through" : ""}`}>
          {comment.body}
        </div>
      )}
    </div>
  );
}

interface NewCommentFormProps {
  onSubmit: (body: string) => Promise<void>;
  onCancel: () => void;
}

function NewCommentForm({ onSubmit, onCancel }: NewCommentFormProps) {
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!body.trim()) return;
    setBusy(true);
    try {
      await onSubmit(body);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="my-1 mx-2 px-2 py-1.5 rounded border border-amber-900 bg-amber-950/20">
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={3}
        autoFocus
        placeholder="Leave a comment for the agent…"
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
            e.preventDefault();
            void submit();
          }
        }}
        className="w-full bg-zinc-900 border border-zinc-700 rounded p-1.5 text-xs text-zinc-100 font-sans"
      />
      <div className="mt-1 flex justify-end gap-1.5">
        <button
          onClick={onCancel}
          className="px-2 py-0.5 text-[11px] text-zinc-400 hover:text-zinc-100"
        >
          <X size={11} className="inline mr-0.5" />
          Cancel
        </button>
        <button
          onClick={submit}
          disabled={busy || !body.trim()}
          className="px-2 py-0.5 text-[11px] bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-900 text-white rounded"
        >
          Add comment
        </button>
      </div>
    </div>
  );
}

interface Props {
  conversationId: string;
  filePath: string;
  diffText: string;
}

export function InlineCommentLayer({
  conversationId,
  filePath,
  diffText,
}: Props) {
  const lines = parseDiffLines(diffText);
  const comments = useReviewStore(
    (s) => s.byConversation[conversationId] ?? []
  );
  const addDraft = useReviewStore((s) => s.addDraft);
  const editDraft = useReviewStore((s) => s.editDraft);
  const removeDraft = useReviewStore((s) => s.removeDraft);
  const resolve = useReviewStore((s) => s.resolve);

  const [composing, setComposing] = useState<AnchorKey | null>(null);

  if (lines.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-zinc-600 text-xs">
        No diff for {filePath}
      </div>
    );
  }

  const commentsForFile = comments.filter((c) => c.filePath === filePath);

  return (
    <div className="font-mono text-xs leading-5">
      {lines.map((line, i) => {
        const anchor = preferredAnchor(line);
        const lineComments = anchor
          ? commentsForFile.filter(
              (c) =>
                c.side === anchor.side && c.lineNumber === anchor.lineNumber
            )
          : [];
        const isComposingHere =
          composing &&
          anchor &&
          composing.side === anchor.side &&
          composing.lineNumber === anchor.lineNumber;

        return (
          <div key={i}>
            <div className={`group flex ${lineColors[line.type]}`}>
              <span className="w-10 text-right pr-1 text-zinc-600 select-none shrink-0 border-r border-zinc-800">
                {line.oldLineNo ?? ""}
              </span>
              <span className="w-10 text-right pr-1 text-zinc-600 select-none shrink-0 border-r border-zinc-800">
                {line.newLineNo ?? ""}
              </span>
              <span className="w-5 text-center select-none shrink-0 text-zinc-600 relative">
                {line.type === "added"
                  ? "+"
                  : line.type === "removed"
                    ? "-"
                    : line.type === "header"
                      ? ""
                      : " "}
                {anchor && (
                  <button
                    onClick={() => setComposing(anchor)}
                    className="absolute inset-y-0 -right-1 my-auto opacity-0 group-hover:opacity-100 text-indigo-400 hover:text-indigo-200 bg-zinc-900 border border-indigo-700 rounded-sm w-3 h-3 flex items-center justify-center"
                    title="Add comment"
                  >
                    <MessageSquarePlus size={9} />
                  </button>
                )}
              </span>
              <span className="flex-1 whitespace-pre pl-1">{line.content}</span>
            </div>

            {lineComments.map((c) => (
              <CommentBubble
                key={c.id}
                comment={c}
                onEdit={(body) => editDraft(c.id, body)}
                onDelete={() => removeDraft(c.id)}
                onResolve={() => resolve(c.id)}
              />
            ))}

            {isComposingHere && (
              <NewCommentForm
                onSubmit={async (body) => {
                  await addDraft({
                    conversationId,
                    filePath,
                    side: composing!.side,
                    lineNumber: composing!.lineNumber,
                    body,
                  });
                  setComposing(null);
                }}
                onCancel={() => setComposing(null)}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
