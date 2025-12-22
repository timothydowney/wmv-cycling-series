/**
 * useMarkdownEditor Hook
 *
 * Encapsulates all markdown editing logic (parsing, serialization, mode toggling)
 * separately from UI rendering. This makes the logic testable and reusable.
 *
 * Usage:
 *   const {
 *     editor,
 *     isSourceMode,
 *     sourceText,
 *     charCount,
 *     remaining,
 *     toggleMode,
 *     setSourceText
 *   } = useMarkdownEditor('# Hello', { maxLength: 1000 });
 */

import { useCallback, useEffect, useState } from 'react';
import { useEditor, JSONContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import CharacterCount from '@tiptap/extension-character-count';
import { Markdown } from '@tiptap/markdown';

interface UseMarkdownEditorOptions {
  maxLength?: number;
  onContentChange?: (markdown: string) => void;
}

interface UseMarkdownEditorResult {
  editor: ReturnType<typeof useEditor> | null;
  isSourceMode: boolean;
  sourceText: string;
  charCount: number;
  remaining: number;
  toggleMode: () => void;
  setSourceText: (text: string) => void;
}

const DEFAULT_MAX_LENGTH = 1000;

/**
 * Custom hook for markdown editor state and logic
 *
 * Handles:
 * - Editor initialization with TipTap extensions
 * - Markdown parsing (text → JSON)
 * - Markdown serialization (JSON → text)
 * - Mode toggling (WYSIWYG ↔ Source)
 * - Character counting
 * - Content change callbacks
 *
 * @param initialContent - Initial markdown content
 * @param options - Configuration options
 * @returns Object with editor, state, and handlers
 */
export function useMarkdownEditor(
  initialContent: string,
  options: UseMarkdownEditorOptions = {}
): UseMarkdownEditorResult {
  const { maxLength = DEFAULT_MAX_LENGTH, onContentChange } = options;

  const [isSourceMode, setIsSourceMode] = useState(false);
  const [sourceText, setSourceText] = useState('');

  // Initialize editor with TipTap
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
    content: '',
    onUpdate: ({ editor }) => {
      try {
        const manager = editor.storage.markdown.manager;
        if (!manager) {
          console.warn('Markdown manager not initialized');
          return;
        }
        const markdown = manager.serialize(editor.getJSON());
        setSourceText(markdown);
        if (onContentChange) {
          onContentChange(markdown);
        }
      } catch (error) {
        console.warn('Error serializing markdown:', error);
      }
    }
  });

  /**
   * Parse markdown string into TipTap JSON content
   * This is called when switching from source mode to WYSIWYG
   */
  const parseMarkdown = useCallback(
    (markdown: string): JSONContent | null => {
      if (!editor) return null;

      try {
        const manager = editor.storage.markdown?.manager;
        if (!manager) {
          console.warn('Markdown manager not initialized for parsing');
          return null;
        }
        return manager.parse(markdown);
      } catch (error) {
        console.warn('Error parsing markdown:', error);
        return null;
      }
    },
    [editor]
  );

  /**
   * Serialize TipTap JSON content into markdown string
   * This is called when switching from WYSIWYG to source mode
   */
  const serializeMarkdown = useCallback(
    (json: JSONContent): string => {
      if (!editor) return '';

      try {
        const manager = editor.storage.markdown?.manager;
        if (!manager) {
          console.warn('Markdown manager not initialized for serialization');
          return '';
        }
        return manager.serialize(json);
      } catch (error) {
        console.warn('Error serializing markdown:', error);
        return '';
      }
    },
    [editor]
  );

  /**
   * Toggle between source and WYSIWYG modes
   * Handles conversion in both directions
   */
  const toggleMode = useCallback(() => {
    if (!editor) return;

    try {
      if (isSourceMode) {
        // Switching from source to WYSIWYG
        // Parse the source text and set as editor content
        const parsed = parseMarkdown(sourceText);
        if (parsed) {
          editor.commands.setContent(parsed);
        }
      } else {
        // Switching from WYSIWYG to source
        // Serialize the editor content to markdown
        const markdown = serializeMarkdown(editor.getJSON());
        setSourceText(markdown);
      }
      setIsSourceMode(!isSourceMode);
    } catch (error) {
      console.error('Error toggling editor mode:', error);
    }
  }, [editor, isSourceMode, sourceText, parseMarkdown, serializeMarkdown]);

  /**
   * Initialize editor content when initial content changes
   * (but only when not in source mode to avoid conflicts)
   */
  useEffect(() => {
    if (editor && initialContent !== undefined && !isSourceMode) {
      // Avoid re-setting content if it matches current internal state
      // This prevents cursor jumping when typing forces a parent re-render
      if (initialContent === sourceText) {
        return;
      }

      setSourceText(initialContent);
      try {
        const manager = editor.storage.markdown?.manager;
        if (manager) {
          const parsed = manager.parse(initialContent);
          editor.commands.setContent(parsed);
        }
      } catch (error) {
        console.warn('Error setting initial markdown content:', error);
      }
    }
  }, [initialContent, editor, isSourceMode, sourceText]);

  // Calculate character count based on current mode
  const charCount = isSourceMode
    ? sourceText.length
    : editor?.storage.characterCount?.characters?.() ?? 0;

  const remaining = maxLength - charCount;

  return {
    editor,
    isSourceMode,
    sourceText,
    charCount,
    remaining,
    toggleMode,
    setSourceText
  };
}
