import { useEffect } from "react";

const SITE_NAME = "Sachfitsin";
const ORIGIN = "https://sachfitsin.com";

interface SeoOptions {
    /** Page title, without the site name. */
    title: string;
    /** One sentence for the search result. Aim for under 160 characters. */
    description?: string;
    /** Path only, e.g. "/content". Defaults to the current path. */
    path?: string;
    /** Keep this page out of search results. */
    noIndex?: boolean;
}

function setMeta(selector: string, attr: string, value: string) {
    let tag = document.head.querySelector<HTMLMetaElement>(selector);

    if (!tag) {
        tag = document.createElement("meta");

        const [name, content] = selector
            .replace(/^meta\[/, "")
            .replace(/\]$/, "")
            .split("=");

        tag.setAttribute(name, content.replace(/["']/g, ""));
        document.head.appendChild(tag);
    }

    tag.setAttribute(attr, value);
}

/**
 * Set the title, description and canonical URL for one page.
 *
 * A note on what this can and cannot do. Google renders JavaScript, so it
 * will see these. Facebook, WhatsApp and most other link previewers do
 * NOT, so they only ever read the static tags in index.html. Per-page
 * share previews would need prerendering or server rendering, which is a
 * much bigger change than this hook.
 */
export function useSeo({ title, description, path, noIndex }: SeoOptions) {
    useEffect(() => {
        const fullTitle = title
            ? `${title} | ${SITE_NAME}`
            : `${SITE_NAME} | Diet Plans and Nutrition Guidance`;

        document.title = fullTitle;

        if (description) {
            setMeta('meta[name="description"]', "content", description);
        }

        setMeta(
            'meta[name="robots"]',
            "content",
            noIndex
                ? "noindex, nofollow"
                : "index, follow, max-image-preview:large",
        );

        const href = `${ORIGIN}${path ?? window.location.pathname}`;

        let link = document.head.querySelector<HTMLLinkElement>(
            'link[rel="canonical"]',
        );

        if (!link) {
            link = document.createElement("link");
            link.rel = "canonical";
            document.head.appendChild(link);
        }

        link.href = href;
    }, [title, description, path, noIndex]);
}
