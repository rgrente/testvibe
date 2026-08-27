import { cloneElement, isValidElement, type ReactElement, type ReactNode } from "react";

interface SharedToolbarProps {
  children: ReactNode;
  label: string;
  className?: string;
}

const controlClassName =
  "min-h-11 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]";

export function SharedToolbar({ children, label, className = "" }: SharedToolbarProps) {
  return (
    <div
      role="toolbar"
      aria-label={label}
      className={`flex h-11 items-center gap-2 border-y border-[var(--color-border)] bg-[var(--color-canvas)] px-2 sm:px-4 ${className}`}
    >
      {Array.isArray(children)
        ? children.map((child) => addControlContract(child))
        : addControlContract(children)}
    </div>
  );
}

function addControlContract(child: ReactNode): ReactNode {
  if (!isValidElement<{ className?: string }>(child)) return child;
  return cloneElement(child as ReactElement<{ className?: string }>, {
    className: `${controlClassName} ${child.props.className ?? ""}`.trim(),
  });
}
