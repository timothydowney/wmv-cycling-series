import React, { useEffect, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import CharacterCount from '@tiptap/extension-character-count';
import { Markdown } from '@tiptap/markdown';
import './NotesEditor.css';

interface NotesEditorProps {
  value: string;
  onChange: (markdown: string) => void;
  maxLength?: number;
}

const NOTES_MAX_LENGTH = 1000;

export const NotesEditor: React.FC<NotesEditorProps> = ({
  value,
  onChange,
  maxLength = NOTES_MAX_LENGTH
}) => {
  const [isSourceMode, setIsSourceMode] = useState(false);
  const [sourceText, setSourceText] = useState(value || '');

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3]
        }
      }),
      Markdown.configure({
        indentation: {
          style: 'space',
          size: 2
        }
      }),
      CharacterCount.configure({
        limit: maxLength
      })
    ],
    content: '', // Start empty, we'll set content via effect
    onUpdate: ({ editor }) => {
      // Get markdown directly from the Markdown extension's manager
      try {
        const manager = editor.storage.markdown.manager;
        const markdown = manager.serialize(editor.getJSON());
        setSourceText(markdown);
        onChange(markdown);
      } catch (error) {
        console.warn('Error getting markdown:', error);
      }
    }
  });

  // Handle initial value and external changes - parse markdown properly
  useEffect(() => {
    if (editor && value !== undefined && !isSourceMode) {
      setSourceText(value);
      try {
        const manager = editor.storage.markdown.manager;
        if (manager) {
          // Parse markdown into JSON content structure
          const parsed = manager.parse(value);
          editor.commands.setContent(parsed);
        }
      } catch (error) {
        console.warn('Error parsing markdown for editor:', error);
      }
    }
  }, [value, editor, isSourceMode]);

  if (!editor) {
    return <div className="notes-editor-skeleton">Loading editor...</div>;
  }

  const handleModeToggle = (manager: any) => {
    if (isSourceMode) {
      // Switching from source to WYSIWYG
      const parsed = manager.parse(sourceText);
      editor.commands.setContent(parsed);
    } else {
      // Switching from WYSIWYG to source
      const markdown = manager.serialize(editor.getJSON());
      setSourceText(markdown);
    }
    setIsSourceMode(!isSourceMode);
  };

  const charCount = isSourceMode ? sourceText.length : editor.storage.characterCount.characters();
  const remaining = maxLength - charCount;

  return (
    <div className="notes-editor-container">
      <div className="notes-editor-toolbar">
        {!isSourceMode ? (
          <>
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleBold().run()}
              disabled={!editor.can().chain().focus().toggleBold().run()}
              className={`toolbar-btn ${editor.isActive('bold') ? 'active' : ''}`}
              title="Bold (Ctrl+B)"
            >
              <strong>B</strong>
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleItalic().run()}
              disabled={!editor.can().chain().focus().toggleItalic().run()}
              className={`toolbar-btn ${editor.isActive('italic') ? 'active' : ''}`}
              title="Italic (Ctrl+I)"
            >
              <em>I</em>
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleBulletList().run()}
              className={`toolbar-btn ${editor.isActive('bulletList') ? 'active' : ''}`}
              title="Bullet List"
            >
              •
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
              className={`toolbar-btn ${editor.isActive('orderedList') ? 'active' : ''}`}
              title="Numbered List"
            >
              1.
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleCode().run()}
              disabled={!editor.can().chain().focus().toggleCode().run()}
              className={`toolbar-btn ${editor.isActive('code') ? 'active' : ''}`}
              title="Code"
            >
              {'<>'}
            </button>
            <button
              type="button"
              onClick={() => {
                const url = prompt('Enter URL:');
                if (url) {
                  editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
                }
              }}
              disabled={!editor.can().chain().focus().toggleLink({ href: 'http://example.com' }).run()}
              className={`toolbar-btn ${editor.isActive('link') ? 'active' : ''}`}
              title="Link (Ctrl+K)"
            >
              🔗
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().clearNodes().run()}
              className="toolbar-btn"
              title="Clear Formatting"
            >
              ⟲
            </button>
          </>
        ) : null}
        <div className="toolbar-separator" />
        <button
          type="button"
          onClick={() => {
            try {
              const manager = editor?.storage?.markdown?.manager;
              if (!manager) {
                console.warn('Markdown manager not yet initialized, waiting...');
                // Try again after a brief delay
                setTimeout(() => {
                  const retryManager = editor?.storage?.markdown?.manager;
                  if (retryManager) {
                    handleModeToggle(retryManager);
                  } else {
                    console.error('Markdown manager failed to initialize');
                  }
                }, 100);
                return;
              }

              handleModeToggle(manager);
            } catch (error) {
              console.error('Error toggling editor mode:', error);
            }
          }}
          className="toolbar-btn mode-toggle"
          title={isSourceMode ? 'Switch to Editor Mode' : 'Switch to Source Mode'}
        >
          {isSourceMode ? '{ }' : '✎'}
        </button>
      </div>

      {!isSourceMode ? (
        <div 
          className={`notes-editor-wrapper ${remaining < 100 ? 'warning' : ''}`}
          onClick={() => editor?.chain().focus().run()}
          role="textbox"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Tab') {
              e.preventDefault();
              editor?.chain().focus().run();
            }
          }}
        >
          <EditorContent editor={editor} className="notes-editor" />
        </div>
      ) : (
        <textarea
          className={`notes-source-editor ${remaining < 100 ? 'warning' : ''}`}
          value={sourceText}
          onChange={(e) => {
            const text = e.target.value;
            if (text.length <= maxLength) {
              setSourceText(text);
              onChange(text);
            }
          }}
          placeholder="Type your notes in markdown format..."
          spellCheck="true"
        />
      )}

      <div className="notes-editor-footer">
        <div className="char-count">
          {charCount} / {maxLength} characters
          {remaining < 100 && remaining > 0 && (
            <span className="warning-text"> ({remaining} remaining)</span>
          )}
          {remaining === 0 && <span className="error-text"> (limit reached)</span>}
        </div>
        <div className="editor-hint">
          {isSourceMode ? (
            <>💡 <strong>Markdown</strong> mode • **bold**, *italic*, - lists, # headings</>
          ) : (
            <>💡 Supports <strong>markdown</strong> — type directly or use toolbar</>
          )}
        </div>
      </div>
    </div>
  );
};

