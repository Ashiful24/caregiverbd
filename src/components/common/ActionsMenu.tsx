import { Dropdown } from "../ui/dropdown/Dropdown";

export interface ActionsMenuProps {
  /** Whether the dropdown is open (e.g. openActionsId === row.id) */
  isOpen: boolean;
  /** Called when the menu should close */
  onClose: () => void;
  /** Called when the trigger button is clicked (toggle) */
  onButtonClick: () => void;
  /** Ref for the trigger button; assign when this row is the open one (for portal positioning) */
  buttonRef?: React.RefObject<HTMLButtonElement | null>;
  /** Optional class for the dropdown panel */
  dropdownClassName?: string;
  /** Optional class for the trigger button */
  buttonClassName?: string;
  /** DropdownItem(s) or other menu content */
  children: React.ReactNode;
  /** Accessible label for the trigger (default: "Actions") */
  ariaLabel?: string;
}

const DEFAULT_BUTTON_CLASS =
  "dropdown-toggle inline-flex min-h-[32px] min-w-[32px] items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700";

/**
 * Reusable three-dot actions menu: trigger button + dropdown.
 * Use in list tables and mobile cards for row actions (View full details, etc.).
 */
export function ActionsMenu({
  isOpen,
  onClose,
  onButtonClick,
  buttonRef,
  dropdownClassName = "min-w-[160px] py-1",
  buttonClassName = DEFAULT_BUTTON_CLASS,
  children,
  ariaLabel = "Actions",
}: ActionsMenuProps) {
  return (
    <div className="relative inline-block">
      <button
        ref={buttonRef}
        type="button"
        onClick={onButtonClick}
        className={buttonClassName}
        aria-label={ariaLabel}
      >
        <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
        </svg>
      </button>
      <Dropdown
        isOpen={isOpen}
        onClose={onClose}
        anchorRef={buttonRef}
        className={dropdownClassName}
      >
        {children}
      </Dropdown>
    </div>
  );
}
