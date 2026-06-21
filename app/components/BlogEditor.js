'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import { Markdown } from 'tiptap-markdown';

function ToolbarButton({ onClick, active, title, children }) {
  return (
    <button
      type="button"
      onMouseDown={e => { e.preventDefault(); onClick(); }}
      className={`blog-editor-tool${active ? ' blog-editor-tool-active' : ''}`}
      title={title}
    >
      {children}
    </button>
  );
}

function Toolbar({ editor }) {
  if (!editor) return null;
  return (
    <div className="blog-editor-toolbar">
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        active={editor.isActive('heading', { level: 2 })}
        title="Heading 2"
      >H2</ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        active={editor.isActive('heading', { level: 3 })}
        title="Heading 3"
      >H3</ToolbarButton>
      <div className="blog-editor-divider" />
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBold().run()}
        active={editor.isActive('bold')}
        title="Bold"
      ><strong>B</strong></ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleItalic().run()}
        active={editor.isActive('italic')}
        title="Italic"
      ><em>I</em></ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        active={editor.isActive('underline')}
        title="Underline"
      ><u>U</u></ToolbarButton>
      <div className="blog-editor-divider" />
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleCode().run()}
        active={editor.isActive('code')}
        title="Inline code"
      >{'<>'}</ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        active={editor.isActive('blockquote')}
        title="Blockquote"
      >"</ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        active={editor.isActive('bulletList')}
        title="Bullet list"
      >•</ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        active={editor.isActive('orderedList')}
        title="Ordered list"
      >1.</ToolbarButton>
      <div className="blog-editor-divider" />
      <ToolbarButton
        onClick={() => editor.chain().focus().undo().run()}
        active={false}
        title="Undo"
      >↩</ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().redo().run()}
        active={false}
        title="Redo"
      >↪</ToolbarButton>
    </div>
  );
}

export default function BlogEditor({ initialContent, onSave, onCancel, saving }) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Underline,
      Markdown.configure({
        html: true,
        tightLists: true,
        transformPastedText: true,
      }),
    ],
    content: initialContent,
  });

  function handleSave() {
    if (!editor) return;
    const markdown = editor.storage.markdown.getMarkdown();
    onSave(markdown);
  }

  return (
    <div className="blog-editor-wrap">
      <Toolbar editor={editor} />
      <EditorContent editor={editor} className="blog-editor-content" />
      <div className="def-edit-actions blog-editor-actions">
        <button
          className="def-edit-save"
          onClick={handleSave}
          disabled={saving || !editor}
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button className="def-edit-cancel" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}
