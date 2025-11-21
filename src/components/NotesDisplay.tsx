import React, { useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Markdown } from '@tiptap/markdown';

interface NotesDisplayProps {
  markdown: string;
}

export const NotesDisplay: React.FC<NotesDisplayProps> = ({ markdown }) => {
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
      })
    ],
    content: '',
    editable: false // Read-only
  });

  useEffect(() => {
    if (editor && markdown) {
      try {
        // Use the Markdown extension's manager to parse markdown
        const manager = editor.storage.markdown?.manager;
        if (manager) {
          const parsed = manager.parse(markdown);
          editor.commands.setContent(parsed);
        }
      } catch (error) {
        console.warn('Error parsing markdown for display:', error);
      }
    }
  }, [editor, markdown]);

  if (!editor) {
    return null;
  }

  return <EditorContent editor={editor} className="notes-display-content" />;
};
