import Link from "next/link";

interface EmptyStateAction {
  label: string;
  href?: string;
  onClick?: () => void;
}

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description?: string;
  action?: EmptyStateAction;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  const ActionButton = () => {
    if (!action) return null;
    const className =
      "inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-[#03A9F4] border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors";

    if (action.href) {
      return (
        <Link href={action.href} className={className}>
          {action.label}
        </Link>
      );
    }

    return (
      <button onClick={action.onClick} className={className}>
        {action.label}
      </button>
    );
  };

  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="text-slate-300 mb-4">{icon}</div>
      <p className="text-base font-medium text-slate-900 mb-1">{title}</p>
      {description && (
        <p className="text-sm text-slate-500 text-center max-w-sm mb-5">
          {description}
        </p>
      )}
      <ActionButton />
    </div>
  );
}
