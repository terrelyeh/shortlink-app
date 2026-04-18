import { ChevronLeft } from "lucide-react";
import type { ReactNode } from "react";

interface PageHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  back?: string;
  onBack?: () => void;
  backHref?: string;
}

export function PageHeader({
  title,
  description,
  actions,
  back,
  onBack,
  backHref,
}: PageHeaderProps) {
  const titleIsString = typeof title === "string";
  return (
    <>
      {back &&
        (backHref ? (
          <a href={backHref} className="back-link">
            <ChevronLeft size={13} /> {back}
          </a>
        ) : (
          <button className="back-link" onClick={onBack}>
            <ChevronLeft size={13} /> {back}
          </button>
        ))}
      <div className="page-head">
        <div style={{ minWidth: 0, flex: 1 }}>
          {titleIsString ? (
            <>
              <h1 className="page-title">{title}</h1>
              {description && <p className="page-sub">{description}</p>}
            </>
          ) : (
            <>
              {title}
              {description && <p className="page-sub">{description}</p>}
            </>
          )}
        </div>
        {actions && <div className="row" style={{ flexShrink: 0 }}>{actions}</div>}
      </div>
    </>
  );
}
