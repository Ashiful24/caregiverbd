import type React from "react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

// Must be above modal overlay (99999) so dropdowns inside modals remain visible.
const DROPDOWN_PORTAL_Z_INDEX = 100100;

interface DropdownProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
  /** When set, dropdown is rendered in a portal (document.body) and positioned from this anchor so it stays above footer/overflow. */
  anchorRef?: React.RefObject<HTMLElement | null>;
}

export const Dropdown: React.FC<DropdownProps> = ({
  isOpen,
  onClose,
  children,
  className = "",
  anchorRef,
}) => {
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [portalPosition, setPortalPosition] = useState<{
    top: number;
    right: number;
    placement: "top" | "bottom";
    maxHeight: number;
  } | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        !(event.target as HTMLElement).closest(".dropdown-toggle")
      ) {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [onClose]);

  // When using portal: compute position from anchor after open (ref is set by parent on same render)
  useEffect(() => {
    if (!isOpen || !anchorRef?.current) {
      setPortalPosition(null);
      return;
    }
    const el = anchorRef.current;
    const update = () => {
      const r = el.getBoundingClientRect();
      const gap = 8;
      const dropdownHeight = dropdownRef.current?.offsetHeight ?? 220;
      const spaceBelow = window.innerHeight - r.bottom;
      const spaceAbove = r.top;
      const placement =
        spaceBelow < dropdownHeight + gap && spaceAbove > spaceBelow ? "top" : "bottom";
      const availableSpace = placement === "top" ? spaceAbove : spaceBelow;

      setPortalPosition({
        top: placement === "top" ? r.top - gap : r.bottom + gap,
        right: window.innerWidth - r.right,
        placement,
        maxHeight: Math.max(120, availableSpace - gap * 2),
      });
    };
    const id = window.setTimeout(update, 0);
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [isOpen, anchorRef]);

  if (!isOpen) return null;

  const content = (
    <div
      ref={dropdownRef}
      className={`rounded-xl border border-gray-200 bg-white shadow-theme-lg dark:border-gray-800 dark:bg-gray-dark ${className}`}
      style={
        anchorRef && portalPosition
          ? {
              position: "fixed",
              top: portalPosition.top,
              right: portalPosition.right,
              left: "auto",
              transform:
                portalPosition.placement === "top" ? "translateY(-100%)" : undefined,
              zIndex: DROPDOWN_PORTAL_Z_INDEX,
              minWidth: "160px",
              maxHeight: portalPosition.maxHeight,
              overflowY: "auto",
            }
          : { zIndex: 9999 }
      }
    >
      {children}
    </div>
  );

  if (anchorRef) {
    if (!portalPosition) return null;
    return createPortal(
      content,
      document.body
    );
  }

  return (
    <div
      className="absolute right-0 mt-2"
      style={{ zIndex: 9999 }}
    >
      {content}
    </div>
  );
};
