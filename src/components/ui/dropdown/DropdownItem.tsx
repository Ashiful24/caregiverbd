import type React from "react";
import { Link } from "react-router";

interface DropdownItemProps {
  tag?: "a" | "button";
  to?: string;
  onClick?: () => void;
  onItemClick?: () => void;
  /** Fires on mousedown (before click). Use for actions that must run before dropdown closes. */
  onMouseDown?: (e: React.MouseEvent) => void;
  baseClassName?: string;
  className?: string;
  children: React.ReactNode;
}

export const DropdownItem: React.FC<DropdownItemProps> = ({
  tag = "button",
  to,
  onClick,
  onItemClick,
  onMouseDown,
  baseClassName = "block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-brand-50 hover:text-brand-700 dark:text-gray-300 dark:hover:bg-brand-500/10 dark:hover:text-brand-300",
  className = "",
  children,
}) => {
  const combinedClasses = `${baseClassName} ${className}`.trim();

  const handleClick = (event: React.MouseEvent) => {
    if (tag === "button") {
      event.preventDefault();
    }
    if (onClick) onClick();
    if (onItemClick) onItemClick();
  };

  if (tag === "a" && to) {
    return (
      <Link to={to} className={combinedClasses} onClick={handleClick}>
        {children}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      onMouseDown={onMouseDown}
      className={combinedClasses}
    >
      {children}
    </button>
  );
};
