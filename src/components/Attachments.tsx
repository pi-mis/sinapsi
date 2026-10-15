import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Paperclip,
  Link2,
  Mic,
  Square,
  Trash2,
  FileText,
  File as FileIcon,
  Image as ImageIcon,
  AudioLines,
  ExternalLink,
  LoaderCircle,
} from "lucide-react";
import { Button } from "./ui/button";
import {
  listAttachments,
  uploadFile,
  attachLink,
  removeAttachment,
  type Attachment,
  type UploadStep,
} from "@/attachments/client";
import { signAttachments } from "@/attachments/attachments.functions";
import { displayName } from "@/attachments/kinds";
import { getLang, locale, t as tNow, tr, useT, type Key } from "@/i18n";

const STEP_TEXT: Record<UploadStep, Key> = {
  reading: "Leggo il documento…",
  uploading: "Carico il file…",
  analyzing: "L’AI sta leggendo…",
};
const ICON = {
  image: ImageIcon,
  pdf: FileText,
  text: FileText,
  audio: AudioLines,
  file: FileIcon,
  link: Link2,
} as const;

function pickAudioType() {
  if (typeof MediaRecorder === "undefined") return null;
  for (const type of ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"])
    if (MediaRecorder.isTypeSupported(type)) return type;
  return "";
}

/** Files, photos, voice notes and links inside a neuron. */
export function Attachments({
  noteId,
  isPrivate,
  onChanged,
}: {
  noteId: string;
  isPrivate: boolean;
  onChanged: () => void;
}) {
  const qc = useQueryClient();
  const t = useT();
  const sign = useServerFn(signAttachments);
  const list = useQuery({
    queryKey: ["attachments", noteId],
    queryFn: () => listAttachments(noteId),
  });
  const files = (list.data ?? []).filter((a) => a.kind !== "link");
  const urls = useQuery({
    queryKey: ["attachment-urls", noteId, files.map((f) => f.id).join()],
    queryFn: () => sign({ data: { noteId } }),
    enabled: files.length > 0,
    staleTime: 30 * 60 * 1000,
  });
  const [busy, setBusy] = useState<string | null>(null);
  const [linkOpen, setLinkOpen] = useState(false),
    [link, setLink] = useState("");
  const [recording, setRecording] = useState<{ recorder: MediaRecorder; started: number } | null>(
      null,
    ),
    [elapsed, setElapsed] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!recording) return;
    const timer = setInterval(
      () => setElapsed(Math.round((Date.now() - recording.started) / 1000)),
      500,
    );
    return () => clearInterval(timer);
  }, [recording]);
  useEffect(
    () => () => recording?.recorder.stream.getTracks().forEach((track) => track.stop()),
    [recording],
  );

  const done = async () => {
    await qc.invalidateQueries({ queryKey: ["attachments", noteId] });
    onChanged();
  };
  const run = async (
    label: string,
    job: (step: (s: UploadStep) => void) => Promise<string | null | void>,
  ) => {
    setBusy(label);
    try {
      const warning = await job((s) => setBusy(tNow(STEP_TEXT[s])));
      if (warning) toast.message(tr(warning));
    } catch (e) {
      toast.error(tr((e as Error).message));
    } finally {
      setBusy(null);
      await done();
    }
  };
  const upload = (list: File[]) =>
    run(t("Carico…"), async (step) => {
      const warnings: string[] = [];
      for (const f of list) {
        const { warning } = await uploadFile(noteId, f, step);
        if (warning) warnings.push(warning);
      }
      return warnings.join(" ") || null;
    });
  const record = async () => {
    const type = pickAudioType();
    if (type === null || !navigator.mediaDevices?.getUserMedia) {
      toast.error(t("Questo browser non può registrare audio."));
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size) chunks.push(e.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        const mime = recorder.mimeType || type || "audio/webm";
        const ext = mime.includes("mp4") ? "m4a" : mime.includes("ogg") ? "ogg" : "webm";
        const stamp = new Date().toLocaleString(locale(getLang())).replace(/[/:, ]+/g, "-");
        void upload([
          new File(chunks, `${t("vocale")}-${stamp}.${ext}`, { type: mime.split(";")[0] ?? mime }),
        ]);
      };
      recorder.start();
      setElapsed(0);
      setRecording({ recorder, started: Date.now() });
    } catch {
      toast.error(t("Microfono non disponibile: controlla i permessi."));
    }
  };
  const stop = () => {
    recording?.recorder.stop();
    setRecording(null);
  };

  const items = list.data ?? [];
  return (
    <section aria-label={t("Allegati")}>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-xs text-muted-foreground">
          {t("Allegati")}
          {items.length ? ` · ${items.length}` : ""}
        </h3>
        {busy && (
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <LoaderCircle className="size-3.5 animate-spin" />
            {busy}
          </span>
        )}
      </div>
      {isPrivate && (
        <p className="mb-2 text-xs text-muted-foreground">
          {t(
            "Nota privata: documenti e testi restano leggibili sul tuo dispositivo, ma l’AI non analizza foto e vocali.",
          )}
        </p>
      )}
      {items.length > 0 && (
        <ul className="mb-3 space-y-2">
          {items.map((a) => (
            <AttachmentRow
              key={a.id}
              attachment={a}
              url={urls.data?.[a.uri]}
              onDelete={() => run(t("Elimino…"), () => removeAttachment(noteId, a.id))}
            />
          ))}
        </ul>
      )}
      {recording ? (
        <div className="flex items-center gap-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2">
          <span className="size-2.5 animate-pulse rounded-full bg-destructive" />
          <span className="flex-1 font-mono text-sm">
            {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, "0")}
          </span>
          <Button size="sm" variant="secondary" onClick={stop}>
            <Square />
            {t("Fine")}
          </Button>
        </div>
      ) : linkOpen ? (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!link.trim()) return;
            const value = link;
            setLink("");
            setLinkOpen(false);
            void run(t("Leggo la pagina…"), async () => {
              await attachLink(noteId, value);
            });
          }}
        >
          <input
            autoFocus
            type="url"
            inputMode="url"
            placeholder="https://…"
            aria-label={t("Link da salvare")}
            className="h-9 min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-base outline-none focus:border-ring sm:text-sm"
            value={link}
            onChange={(e) => setLink(e.target.value)}
          />
          <Button type="submit" size="sm">
            {t("Salva")}
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setLinkOpen(false)}>
            {t("Annulla")}
          </Button>
        </form>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="secondary"
            disabled={!!busy}
            onClick={() => input.current?.click()}
          >
            <Paperclip />
            {t("File o foto")}
          </Button>
          <Button size="sm" variant="secondary" disabled={!!busy} onClick={() => setLinkOpen(true)}>
            <Link2 />
            Link
          </Button>
          <Button size="sm" variant="secondary" disabled={!!busy} onClick={() => void record()}>
            <Mic />
            {t("Vocale")}
          </Button>
        </div>
      )}
      <input
        ref={input}
        type="file"
        multiple
        className="hidden"
        aria-label={t("Aggiungi file")}
        accept="image/*,application/pdf,audio/*,text/*,.md,.txt,.csv"
        onChange={(e) => {
          const chosen = Array.from(e.target.files ?? []);
          e.target.value = "";
          if (chosen.length) void upload(chosen);
        }}
      />
    </section>
  );
}

function AttachmentRow({
  attachment: a,
  url,
  onDelete,
}: {
  attachment: Attachment;
  url: string | undefined;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const t = useT();
  const Icon = ICON[a.kind] ?? FileIcon;
  const name = a.kind === "link" ? a.extracted_text?.split("\n")[0] || a.uri : displayName(a.uri);
  const href = a.kind === "link" ? a.uri : url;
  const summary =
    a.kind === "link" ? a.extracted_text?.split("\n").slice(1).join("\n") : a.extracted_text;
  return (
    <li className="rounded-md border border-border bg-background/40 p-2">
      {a.kind === "image" && url && (
        <a href={url} target="_blank" rel="noreferrer">
          <img
            src={url}
            alt={summary?.slice(0, 120) || name}
            loading="lazy"
            className="mb-2 max-h-56 w-full rounded object-cover"
          />
        </a>
      )}
      {a.kind === "audio" && url && (
        <audio controls preload="none" src={url} className="mb-2 h-9 w-full" />
      )}
      <div className="flex items-center gap-2">
        <Icon className="size-4 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate text-sm" title={name}>
          {name}
        </span>
        {summary && (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-xs text-muted-foreground"
            aria-expanded={open}
            onClick={() => setOpen(!open)}
          >
            {a.kind === "audio"
              ? t("Trascrizione")
              : a.kind === "link"
                ? t("Riassunto")
                : a.kind === "image"
                  ? t("Descrizione")
                  : t("Testo")}
          </Button>
        )}
        {href && (
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            aria-label={t("Apri {name}", { name })}
            className="grid size-7 place-items-center rounded text-muted-foreground hover:bg-accent"
          >
            <ExternalLink className="size-3.5" />
          </a>
        )}
        <Button
          size="icon"
          variant="ghost"
          className="size-7 text-muted-foreground"
          aria-label={t("Elimina {name}", { name })}
          onClick={onDelete}
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>
      {open && summary && (
        <p className="mt-2 max-h-48 overflow-y-auto whitespace-pre-wrap break-words text-xs leading-5 text-muted-foreground">
          {summary}
        </p>
      )}
    </li>
  );
}
