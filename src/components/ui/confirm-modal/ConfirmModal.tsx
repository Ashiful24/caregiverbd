import { useState } from "react";
import { Modal } from "../modal";

export type ConfirmVariant = "danger" | "primary" | "default";

export interface ConfirmModalProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Called when modal should close (Cancel, backdrop, Escape) */
  onClose: () => void;
  /** Modal title */
  title: string;
  /** Body content: string or ReactNode for custom content */
  message: React.ReactNode;
  /** Confirm button label (e.g. "Deactivate", "Delete", "Confirm") */
  confirmLabel?: string;
  /** Cancel button label */
  cancelLabel?: string;
  /** Confirm button style: danger (red), primary (brand), default (neutral) */
  confirmVariant?: ConfirmVariant;
  /** Called when user clicks Confirm. If returns a Promise, modal shows loading until it resolves. Rejected promise keeps modal open. */
  onConfirm: () => void | Promise<void>;
  /** Close modal after onConfirm resolves (default true). Set false if parent closes manually. */
  closeOnConfirm?: boolean;
  /** Called when onConfirm rejects (optional, e.g. to show error toast) */
  onError?: (error: unknown) => void;
  /** Optional class for the modal content wrapper */
  className?: string;
}

const variantButtonClasses: Record<ConfirmVariant, string> = {
  danger:
    "bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 dark:bg-red-600 dark:hover:bg-red-700",
  primary:
    "bg-brand-500 text-white hover:bg-brand-600 disabled:opacity-50 dark:bg-brand-500 dark:hover:bg-brand-600",
  default:
    "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700",
};

export function ConfirmModal({
  isOpen,
  onClose,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  confirmVariant = "default",
  onConfirm,
  closeOnConfirm = true,
  onError,
  className,
}: ConfirmModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleClose = () => {
    if (!isSubmitting) onClose();
  };

  const handleConfirm = async () => {
    setIsSubmitting(true);
    try {
      await Promise.resolve(onConfirm());
      if (closeOnConfirm) onClose();
    } catch (err) {
      onError?.(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      className={`max-w-md p-6 sm:p-8 ${className ?? ""}`}
    >
      <h3 className="text-xl font-semibold text-gray-800 dark:text-white/90">
        {title}
      </h3>
      <div className="mt-3 text-sm text-gray-600 dark:text-gray-400">
        {message}
      </div>
      <div className="mt-6 flex flex-wrap justify-end gap-3">
        <button
          type="button"
          onClick={handleClose}
          disabled={isSubmitting}
          className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={isSubmitting}
          className={`rounded-lg px-4 py-2.5 text-sm font-medium ${variantButtonClasses[confirmVariant]}`}
        >
          {isSubmitting ? (
            <span className="inline-flex items-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              {confirmLabel}…
            </span>
          ) : (
            confirmLabel
          )}
        </button>
      </div>
    </Modal>
  );
}
