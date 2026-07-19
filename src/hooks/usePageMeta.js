import { useEffect } from "react";

const BASE = "Dubbed";
const SEP = " — ";
const ORIGIN = "https://dubbed.pro";

export function usePageMeta(title, description) {
  useEffect(() => {
    const prev = document.title;
    document.title = title ? `${title}${SEP}${BASE}` : `${BASE}${SEP}Cash Matches for COD Players`;

    const metaDesc = document.querySelector('meta[name="description"]');
    const prevDesc = metaDesc?.getAttribute("content");
    if (description && metaDesc) metaDesc.setAttribute("content", description);

    const ogTitle = document.querySelector('meta[property="og:title"]');
    const prevOg = ogTitle?.getAttribute("content");
    if (ogTitle) ogTitle.setAttribute("content", document.title);

    const ogDesc = document.querySelector('meta[property="og:description"]');
    const prevOgDesc = ogDesc?.getAttribute("content");
    if (description && ogDesc) ogDesc.setAttribute("content", description);

    const canonical = document.querySelector('link[rel="canonical"]');
    const prevCanonical = canonical?.getAttribute("href");
    if (canonical) canonical.setAttribute("href", ORIGIN + window.location.pathname);

    const ogUrl = document.querySelector('meta[property="og:url"]');
    const prevOgUrl = ogUrl?.getAttribute("content");
    if (ogUrl) ogUrl.setAttribute("content", ORIGIN + window.location.pathname);

    return () => {
      document.title = prev;
      if (prevDesc && metaDesc) metaDesc.setAttribute("content", prevDesc);
      if (prevOg && ogTitle) ogTitle.setAttribute("content", prevOg);
      if (prevOgDesc && ogDesc) ogDesc.setAttribute("content", prevOgDesc);
      if (prevCanonical && canonical) canonical.setAttribute("href", prevCanonical);
      if (prevOgUrl && ogUrl) ogUrl.setAttribute("content", prevOgUrl);
    };
  }, [title, description]);
}
