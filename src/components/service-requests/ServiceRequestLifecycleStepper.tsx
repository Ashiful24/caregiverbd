export type LifecycleStepItem = {
  title: string;
  description: string;
};

type StepState = "completed" | "active" | "pending";

function stepState(activeIndex: number, index: number, total: number): StepState {
  if (activeIndex >= total) return "completed";
  if (index < activeIndex) return "completed";
  if (index === activeIndex) return "active";
  return "pending";
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M2 6L5 9L10 3"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export interface ServiceRequestLifecycleStepperProps {
  steps: LifecycleStepItem[];
  /** Step index that is currently in progress. Use `steps.length` when every step is completed. */
  activeIndex: number;
}

/**
 * Vertical lifecycle stepper (completed / active / pending) aligned with admin service-request detail.
 * Completed steps and connectors use the theme primary (brand); upcoming steps stay neutral grey.
 */
export function ServiceRequestLifecycleStepper({
  steps,
  activeIndex,
}: ServiceRequestLifecycleStepperProps) {
  return (
    <div className="flex flex-col">
      {steps.map((step, index) => {
        const state = stepState(activeIndex, index, steps.length);
        const isLast = index === steps.length - 1;
        const lineSolid = state === "completed";

        return (
          <div key={index} className="flex gap-4">
            <div className="flex w-10 shrink-0 flex-col items-center">
              {state === "completed" && (
                <div
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white dark:bg-brand-500"
                  aria-hidden
                >
                  <CheckIcon className="h-3 w-3" />
                </div>
              )}
              {state === "active" && (
                <div
                  className="box-border flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-600 ring-[3px] ring-brand-100 dark:bg-brand-500 dark:ring-brand-900/50"
                  aria-current="step"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-white" />
                </div>
              )}
              {state === "pending" && (
                <div
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#D1D5DB] dark:bg-gray-600"
                  aria-hidden
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-gray-300 dark:bg-gray-500" />
                </div>
              )}
              {!isLast && (
                <div
                  className={`mt-2 w-0.5 flex-1 min-h-[2.5rem] ${
                    lineSolid
                      ? "bg-brand-600 dark:bg-brand-500"
                      : "bg-[#D1D5DB] dark:bg-gray-600"
                  }`}
                  aria-hidden
                />
              )}
            </div>
            <div className={`min-w-0 flex-1 ${isLast ? "pb-0" : "pb-8"}`}>
              <h4 className="text-base font-semibold leading-snug text-gray-900 dark:text-white/95">
                {step.title}
              </h4>
              <p className="mt-1 text-sm leading-relaxed text-[#6B7280] dark:text-gray-400">
                {step.description}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
