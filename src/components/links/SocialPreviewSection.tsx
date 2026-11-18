"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown, ChevronUp, ImageOff, Share2 } from "lucide-react";

interface SocialPreviewSectionProps {
  title: string;
  description: string;
  image: string;
  onTitleChange: (v: string) => void;
  onDescriptionChange: (v: string) => void;
  onImageChange: (v: string) => void;
  /** og:* scraped from the destination — shown as the fallback. */
  scraped: { title: string | null; description: string | null; image: string | null };
  fallbackTitle: string;
  destinationUrl: string;
  defaultOpen: boolean;
}

const inputClass =
  "w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:ring-1 focus:ring-[#03A9F4] focus:border-[#03A9F4]";

/**
 * Edit-page section for the social-preview override (og:title /
 * og:description / og:image served to link-preview crawlers by
 * /s/[code]). Shows a live card using the same fallback order as the
 * server: override → scraped destination value → link title.
 */
export function SocialPreviewSection({
  title,
  description,
  image,
  onTitleChange,
  onDescriptionChange,
  onImageChange,
  scraped,
  fallbackTitle,
  destinationUrl,
  defaultOpen,
}: SocialPreviewSectionProps) {
  const t = useTranslations("links");
  // Until the user toggles it, the section is open iff the saved link
  // already has an override (`defaultOpen` comes from server data, not
  // form state, so clearing a field while typing doesn't collapse it).
  const [toggled, setToggled] = useState<boolean | null>(null);
  const open = toggled ?? defaultOpen;
  const setOpen = setToggled;
  const [brokenImage, setBrokenImage] = useState<string | null>(null);

  const cardTitle = title || scraped.title || fallbackTitle;
  const cardDescription = description || scraped.description || "";
  const cardImage = image || scraped.image || "";
  let domain = "";
  try {
    domain = new URL(destinationUrl).hostname.replace(/^www\./, "");
  } catch {
    // Destination still being typed — leave the domain line blank.
  }

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
            <Share2 className="w-5 h-5 text-slate-500" />
          </div>
          <div className="text-left">
            <span className="font-semibold text-slate-700 block">{t("socialPreview")}</span>
            <span className="text-xs text-slate-500">{t("socialPreviewDesc")}</span>
          </div>
        </div>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${open ? "bg-sky-100" : "bg-slate-100"}`}>
          {open ? <ChevronUp className="w-5 h-5 text-[#03A9F4]" /> : <ChevronDown className="w-5 h-5 text-slate-500" />}
        </div>
      </button>

      {open && (
        <div className="p-5 border-t border-slate-200 bg-slate-50/50 grid gap-5 md:grid-cols-2">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                {t("socialPreviewTitle")}
              </label>
              <input
                type="text"
                value={title}
                maxLength={200}
                onChange={(e) => onTitleChange(e.target.value)}
                placeholder={scraped.title ?? fallbackTitle}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                {t("socialPreviewDescription")}
              </label>
              <textarea
                value={description}
                maxLength={500}
                rows={3}
                onChange={(e) => onDescriptionChange(e.target.value)}
                placeholder={scraped.description ?? ""}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                {t("socialPreviewImage")}
              </label>
              <input
                type="url"
                value={image}
                onChange={(e) => onImageChange(e.target.value)}
                placeholder="https://"
                className={inputClass}
              />
              <p className="mt-1.5 text-xs text-slate-500">{t("socialPreviewImageHint")}</p>
            </div>
          </div>

          <div>
            <span className="block text-sm font-semibold text-slate-700 mb-1.5">
              {t("socialPreviewCard")}
            </span>
            <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
              {cardImage && brokenImage !== cardImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={cardImage}
                  alt=""
                  referrerPolicy="no-referrer"
                  onError={() => setBrokenImage(cardImage)}
                  className="w-full aspect-[1.91/1] object-cover bg-slate-100"
                />
              ) : (
                <div className="w-full aspect-[1.91/1] bg-slate-100 flex flex-col items-center justify-center gap-1 text-slate-400 text-xs">
                  <ImageOff className="w-5 h-5" />
                  {t("socialPreviewNoImage")}
                </div>
              )}
              <div className="px-3 py-2.5 bg-slate-50 border-t border-slate-200">
                {domain && (
                  <div className="text-[11px] uppercase tracking-wide text-slate-500 truncate">{domain}</div>
                )}
                <div className="text-sm font-semibold text-slate-800 line-clamp-2">{cardTitle}</div>
                {cardDescription && (
                  <div className="text-xs text-slate-500 line-clamp-2 mt-0.5">{cardDescription}</div>
                )}
              </div>
            </div>
            <p className="mt-2 text-xs text-slate-500">{t("socialPreviewCacheNote")}</p>
          </div>
        </div>
      )}
    </div>
  );
}
