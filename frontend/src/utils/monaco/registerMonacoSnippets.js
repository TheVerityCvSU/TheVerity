// C# Snippets and Language Completion Provider for Monaco Editor in The Verity
import * as monaco from 'monaco-editor';
import { CSHARP_BASIC_SNIPPETS } from './csharpSnippetsBasics.js';
import { CSHARP_ADVANCED_SNIPPETS } from './csharpSnippetsAdvanced.js';
import { CSHARP_KEYWORDS } from './csharpKeywords.js';

export const CSHARP_SNIPPETS = [...CSHARP_BASIC_SNIPPETS, ...CSHARP_ADVANCED_SNIPPETS];

const registeredInstances = new WeakSet();

/**
 * Registers C# snippets and keywords in Monaco Editor instance.
 * Safe to call multiple times (idempotent).
 */
export function registerMonacoSnippets(monacoInstance = monaco) {
  if (!monacoInstance || !monacoInstance.languages) return;
  if (
    monacoInstance._veritySnippetsRegistered ||
    registeredInstances.has(monacoInstance) ||
    registeredInstances.has(monacoInstance.languages)
  ) {
    return;
  }

  registeredInstances.add(monacoInstance);
  if (monacoInstance.languages && typeof monacoInstance.languages === 'object') {
    registeredInstances.add(monacoInstance.languages);
  }

  try {
    monacoInstance._veritySnippetsRegistered = true;
  } catch {
    // Silently ignore if monacoInstance is a frozen ES module namespace object
  }

  try {
    monacoInstance.languages.registerCompletionItemProvider('csharp', {
      triggerCharacters: ['.', ' ', '<', '(', '{', '[', ':'],
      provideCompletionItems: (model, position) => {
        const word = model.getWordUntilPosition(position);
        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: word.startColumn,
          endColumn: word.endColumn,
        };

        const snippetSuggestions = CSHARP_SNIPPETS.map((s, idx) => ({
          label: s.label,
          kind: monacoInstance.languages.CompletionItemKind.Snippet,
          documentation: {
            value: `**${s.detail || s.label}**\n\n${s.documentation || ''}`
          },
          detail: s.detail || 'C# Snippet',
          insertText: s.insertText,
          insertTextRules: monacoInstance.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          range,
          sortText: `00_${String(idx).padStart(3, '0')}_${s.label}`,
        }));

        const keywordSuggestions = CSHARP_KEYWORDS.map(k => ({
          label: k,
          kind: monacoInstance.languages.CompletionItemKind.Keyword,
          detail: 'C# Keyword',
          insertText: k,
          range,
          sortText: `10_${k}`,
        }));

        return {
          suggestions: [...snippetSuggestions, ...keywordSuggestions],
        };
      },
    });
  } catch (err) {
    console.warn('[MonacoSnippets] Failed to register snippets:', err);
  }
}
