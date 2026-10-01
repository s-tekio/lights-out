import { useCallback, useEffect, useRef } from 'react';

type ModalProps = {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly triggerRef?: React.RefObject<HTMLButtonElement | null>;
  readonly dialogId: string;
  readonly titleId: string;
  readonly backdropClassName?: string;
  readonly children: React.ReactNode;
};

const FOCUSABLE_SELECTORS =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

export function Modal({
  isOpen,
  onClose,
  triggerRef,
  dialogId,
  titleId,
  backdropClassName,
  children,
}: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const wasOpenRef = useRef(false);

  const getFocusableElements = useCallback((): HTMLElement[] => {
    const container = dialogRef.current;
    if (!container) {
      return [];
    }

    return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS)).filter(
      (element) => !element.hasAttribute('disabled') && !element.hasAttribute('hidden'),
    );
  }, []);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== 'Tab') {
        return;
      }

      const focusable = getFocusableElements();
      const firstElement = focusable[0];
      const lastElement = focusable[focusable.length - 1];

      if (!firstElement || !lastElement) {
        return;
      }

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose, getFocusableElements]);

  useEffect(() => {
    if (isOpen) {
      wasOpenRef.current = true;
      const focusable = getFocusableElements();
      focusable[0]?.focus();
      return;
    }

    // Restoring focus to the trigger is only correct when the dialog closes.
    // Doing it unconditionally would also run on mount, stealing focus on page
    // load and dropping a screen reader user into the header.
    if (wasOpenRef.current) {
      wasOpenRef.current = false;
      triggerRef?.current?.focus();
    }
  }, [isOpen, triggerRef, getFocusableElements]);

  const handleBackdropClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      onClose();
    }
  };

  if (!isOpen) {
    return null;
  }

  const backdropClasses = ['dialog-backdrop', backdropClassName].filter(Boolean).join(' ');

  return (
    <div className={backdropClasses} onClick={handleBackdropClick}>
      <div
        ref={dialogRef}
        id={dialogId}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="dialog"
      >
        {children}
      </div>
    </div>
  );
}
