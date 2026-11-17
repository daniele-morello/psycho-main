import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import PrivacyNoticeBody from "@/components/PrivacyNoticeBody";

type PrivacyNoticeDialogProps = {
  open: boolean;
  onClose: () => void;
};

export default function PrivacyNoticeDialog({
  open,
  onClose,
}: PrivacyNoticeDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] bg-stone-900/45 flex items-center justify-center p-4 sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="privacy-notice-title"
        className="flex w-full max-w-3xl max-h-[min(90vh,52rem)] flex-col rounded-2xl bg-clay-50 border border-clay-200 shadow-xl"
      >
        <div className="flex items-start justify-between gap-4 px-5 py-4 sm:px-6">
          <h2
            id="privacy-notice-title"
            className="font-cormorant text-3xl text-sage-700 leading-tight"
          >
            Informativa sulla Privacy
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Chiudi informativa"
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-[#3b5440] text-white hover:bg-sage-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#3b5440]"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <div className="mx-4 mb-4 overflow-y-auto rounded-2xl border border-stone-200 bg-white px-5 py-6 sm:mx-6 sm:mb-6 sm:px-8">
          <PrivacyNoticeBody />
        </div>
      </div>
    </div>
  );
}
