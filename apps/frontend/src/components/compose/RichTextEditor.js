import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useRef } from 'react';
import { RedoIcon, UndoIcon } from '@/components/icons';
function ToolButton({ label, onClick, children }) {
    return (_jsx("button", { type: "button", "aria-label": label, title: label, 
        // onMouseDown + preventDefault: a plain onClick would let the button take
        // focus first, collapsing the selection the command needs to act on.
        onMouseDown: (e) => {
            e.preventDefault();
            onClick();
        }, className: "flex h-8 w-8 items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-field hover:text-ink", children: children }));
}
function Divider() {
    return _jsx("span", { className: "mx-1 h-5 w-px shrink-0 bg-line" });
}
const strokeIcon = {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.7,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    className: 'h-[17px] w-[17px]',
};
/**
 * contentEditable surface driven by document.execCommand.
 *
 * execCommand is deprecated, but it remains the only API that performs rich
 * text editing across browsers without pulling in an editor framework, and
 * every current engine still implements it. The alternative at this scope
 * would be a large dependency for a handful of formatting buttons.
 */
export function RichTextEditor({ html, onChange, placeholder }) {
    const editorRef = useRef(null);
    // Only write into the DOM when the incoming value genuinely differs from
    // what is rendered. Assigning innerHTML on every keystroke would reset the
    // caret to the start of the document.
    useEffect(() => {
        const node = editorRef.current;
        if (node && node.innerHTML !== html)
            node.innerHTML = html;
    }, [html]);
    const exec = useCallback((command, value) => {
        editorRef.current?.focus();
        document.execCommand(command, false, value);
        onChange(editorRef.current?.innerHTML ?? '');
    }, [onChange]);
    const isEmpty = !html || html === '<br>' || html === '<div><br></div>';
    return (_jsxs("div", { className: "rounded-2xl bg-field p-4", children: [_jsxs("div", { className: "relative", children: [_jsx("div", { ref: editorRef, contentEditable: true, role: "textbox", "aria-multiline": "true", "aria-label": "Email body", suppressContentEditableWarning: true, onInput: (e) => onChange(e.currentTarget.innerHTML), className: "prose-email min-h-[44px] px-2 py-1 text-[15px] text-ink focus:outline-none" }), isEmpty && (_jsx("span", { className: "pointer-events-none absolute left-2 top-1 text-[15px] text-ink-muted", children: placeholder }))] }), _jsxs("div", { className: "mt-3 flex flex-wrap items-center gap-0.5 rounded-full bg-white px-3 py-1.5", children: [_jsx(ToolButton, { label: "Undo", onClick: () => exec('undo'), children: _jsx(UndoIcon, { className: "h-[17px] w-[17px]" }) }), _jsx(ToolButton, { label: "Redo", onClick: () => exec('redo'), children: _jsx(RedoIcon, { className: "h-[17px] w-[17px]" }) }), _jsx(Divider, {}), _jsxs("label", { className: "flex items-center gap-1 rounded-md px-1 text-ink-muted", children: [_jsx("span", { className: "text-[15px] font-semibold", children: "T" }), _jsx("span", { className: "text-[11px] font-semibold", children: "T" }), _jsxs("select", { "aria-label": "Font size", defaultValue: "3", onChange: (e) => exec('fontSize', e.target.value), className: "w-9 cursor-pointer border-0 bg-transparent text-xs text-ink-muted focus:outline-none", children: [_jsx("option", { value: "2", children: "S" }), _jsx("option", { value: "3", children: "M" }), _jsx("option", { value: "5", children: "L" }), _jsx("option", { value: "6", children: "XL" })] })] }), _jsx(Divider, {}), _jsx(ToolButton, { label: "Bold", onClick: () => exec('bold'), children: _jsx("span", { className: "text-[15px] font-bold text-ink", children: "B" }) }), _jsx(ToolButton, { label: "Italic", onClick: () => exec('italic'), children: _jsx("span", { className: "font-serif text-[15px] italic text-ink", children: "I" }) }), _jsx(ToolButton, { label: "Underline", onClick: () => exec('underline'), children: _jsx("span", { className: "text-[15px] text-ink underline", children: "U" }) }), _jsx(Divider, {}), _jsx(ToolButton, { label: "Align left", onClick: () => exec('justifyLeft'), children: _jsx("svg", { ...strokeIcon, children: _jsx("path", { d: "M4 6h16M4 10h10M4 14h16M4 18h10" }) }) }), _jsx(ToolButton, { label: "Align center", onClick: () => exec('justifyCenter'), children: _jsx("svg", { ...strokeIcon, children: _jsx("path", { d: "M6 4v16M3.5 6.5L6 4l2.5 2.5M3.5 17.5L6 20l2.5-2.5M12 6h9M12 12h9M12 18h9" }) }) }), _jsx(Divider, {}), _jsx(ToolButton, { label: "Numbered list", onClick: () => exec('insertOrderedList'), children: _jsx("svg", { ...strokeIcon, children: _jsx("path", { d: "M10 6h11M10 12h11M10 18h11M4 5h1v4M3.5 9h2M3.5 15.5h2l-2 3h2" }) }) }), _jsx(ToolButton, { label: "Bulleted list", onClick: () => exec('insertUnorderedList'), children: _jsxs("svg", { ...strokeIcon, children: [_jsx("path", { d: "M9 6h12M9 12h12M9 18h12" }), _jsx("circle", { cx: "4.5", cy: "6", r: "1.2", fill: "currentColor", stroke: "none" }), _jsx("circle", { cx: "4.5", cy: "12", r: "1.2", fill: "currentColor", stroke: "none" }), _jsx("circle", { cx: "4.5", cy: "18", r: "1.2", fill: "currentColor", stroke: "none" })] }) }), _jsx(ToolButton, { label: "Indent", onClick: () => exec('indent'), children: _jsx("svg", { ...strokeIcon, children: _jsx("path", { d: "M4 6h16M10 12h10M10 18h10M4 10l3.5 2L4 14z" }) }) }), _jsx(ToolButton, { label: "Outdent", onClick: () => exec('outdent'), children: _jsx("svg", { ...strokeIcon, children: _jsx("path", { d: "M20 6H4M20 12H10M20 18H10M7.5 10L4 12l3.5 2z" }) }) }), _jsx(Divider, {}), _jsx(ToolButton, { label: "Quote", onClick: () => exec('formatBlock', 'blockquote'), children: _jsx("svg", { viewBox: "0 0 24 24", className: "h-[17px] w-[17px]", fill: "currentColor", stroke: "none", children: _jsx("path", { d: "M9.5 7C7 7 5 9 5 11.5S6.8 16 9 16c.3 0 .6 0 .9-.1-.6 1.4-2 2.4-3.4 2.6l.4 1.5c3-.4 5.6-3 5.6-6.9V11c0-2.2-1-4-2.9-4zm9 0C16 7 14 9 14 11.5s1.8 4.5 4 4.5c.3 0 .6 0 .9-.1-.6 1.4-2 2.4-3.4 2.6l.4 1.5c3-.4 5.6-3 5.6-6.9V11c0-2.2-1-4-3-4z" }) }) }), _jsx(ToolButton, { label: "Remove formatting", onClick: () => exec('removeFormat'), children: _jsx("svg", { ...strokeIcon, children: _jsx("path", { d: "M6 5h12M11 5l-2 14M4 19h8M15 11l6 6M21 11l-6 6" }) }) }), _jsx(Divider, {}), _jsx(ToolButton, { label: "Strikethrough", onClick: () => exec('strikeThrough'), children: _jsx("span", { className: "text-[15px] text-ink line-through", children: "S" }) })] })] }));
}
