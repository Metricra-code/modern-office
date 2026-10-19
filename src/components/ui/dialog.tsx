'use client';
import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
interface DialogProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}
export const Dialog = ({ open, title, onClose, children, wide = false }: DialogProps) => {
  const ref = useRef<HTMLDialogElement>(null);
  const returnContext = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      returnContext.current =
        document.activeElement?.parentElement?.closest<HTMLElement>('[tabindex]') ?? null;
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
      // A removed invoker can leave focus inside this closed dialog; keep native return otherwise.
      let context = returnContext.current;
      while (
        context &&
        (document.activeElement === document.body || dialog.contains(document.activeElement))
      ) {
        context.focus({ preventScroll: true });
        context = context.parentElement?.closest<HTMLElement>('[tabindex]') ?? null;
      }
      returnContext.current = null;
    }
  }, [open]);
  return (
    <dialog
      ref={ref}
      className={`dialog ${wide ? 'dialog-wide' : ''}`}
      aria-label={title}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target !== ref.current) return;
        const bounds = ref.current.getBoundingClientRect();
        if (
          event.clientX < bounds.left ||
          event.clientX > bounds.right ||
          event.clientY < bounds.top ||
          event.clientY > bounds.bottom
        )
          onClose();
      }}
    >
      <div className="dialog-heading">
        <h2>{title}</h2>
        <button className="icon-button" aria-label="Close dialog" onClick={onClose}>
          <X size={20} />
        </button>
      </div>
      {open ? children : null}
    </dialog>
  );
};
