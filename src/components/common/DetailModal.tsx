import { Modal } from "../ui/modal";

export interface DetailModalProps {
  /** Modal title (e.g. "Patient details", "Provider details") */
  title: string;
  isOpen: boolean;
  onClose: () => void;
  /** Show loading spinner instead of content */
  loading?: boolean;
  /** When set and not loading, show this message instead of children (e.g. "Could not load details") */
  errorMessage?: string | null;
  /** Main content when loaded successfully */
  children?: React.ReactNode;
  /** Optional max width class (default: max-w-3xl) */
  className?: string;
}

/**
 * Reusable modal for "full details" views: title, loading state, error message, or content.
 * Use on list pages (Patient, Provider, User) for "View full details".
 * Full width and responsive by default.
 */
export function DetailModal({
  title,
  isOpen,
  onClose,
  loading = false,
  errorMessage = null,
  children,
  className = "w-full max-w-[min(96vw,72rem)] p-4 sm:p-6 lg:p-8",
}: DetailModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} className={className}>
      <div className="flex max-h-[85vh] flex-col">
        <h3 className="shrink-0 pr-10 text-xl font-semibold text-gray-800 dark:text-white/90 sm:pr-12">
          {title}
        </h3>
        <div className="min-h-0 w-full flex-1 overflow-y-auto overflow-x-hidden pt-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-10 w-10 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
            </div>
          ) : errorMessage ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {errorMessage}
            </p>
          ) : (
            children
          )}
        </div>
      </div>
    </Modal>
  );
}
