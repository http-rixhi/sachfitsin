export function youtubeId(url?: string | null) {
    if (!url) {
        return null;
    }

    const patterns = [
        /youtu\.be\/([\w-]{6,})/,
        /youtube\.com\/watch\?[^#]*v=([\w-]{6,})/,
        /youtube\.com\/embed\/([\w-]{6,})/,
        /youtube\.com\/shorts\/([\w-]{6,})/,
    ];

    for (const pattern of patterns) {
        const match = url.match(pattern);

        if (match) {
            return match[1];
        }
    }

    return null;
}

export function vimeoId(url?: string | null) {
    if (!url) {
        return null;
    }

    const match = url.match(/vimeo\.com\/(?:video\/)?(\d{6,})/);

    return match ? match[1] : null;
}

export function embedUrl(url?: string | null) {
    const youtube = youtubeId(url);

    if (youtube) {
        return `https://www.youtube.com/embed/${youtube}?autoplay=1&rel=0`;
    }

    const vimeo = vimeoId(url);

    if (vimeo) {
        return `https://player.vimeo.com/video/${vimeo}?autoplay=1`;
    }

    return null;
}

export function posterUrl(
    videoUrl?: string | null,
    thumbnailUrl?: string | null,
) {
    if (thumbnailUrl) {
        return thumbnailUrl;
    }

    const youtube = youtubeId(videoUrl);

    return youtube
        ? `https://img.youtube.com/vi/${youtube}/hqdefault.jpg`
        : null;
}
