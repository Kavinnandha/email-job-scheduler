/**
 * Flattens editor markup to plain text.
 *
 * The scheduler sends text/plain mail, so the rich-text markup has to be
 * reduced before it reaches the API rather than shipping tags into the body.
 * Block boundaries become newlines so paragraphs and list items survive as
 * line breaks instead of running together.
 */
export function htmlToPlainText(html) {
    if (!html)
        return '';
    const container = document.createElement('div');
    container.innerHTML = html
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/(p|div|li|h[1-6]|blockquote)>/gi, '\n')
        // List items read as a list rather than as unlabelled lines.
        .replace(/<li[^>]*>/gi, '• ');
    // textContent, not a regex over the source: it decodes entities and drops
    // attribute values that a tag-stripping regex would leave behind.
    const text = container.textContent ?? '';
    return text
        .replace(/ /g, ' ')
        .replace(/\n{3,}/g, '\n\n')
        .split('\n')
        .map((line) => line.trimEnd())
        .join('\n')
        .trim();
}
