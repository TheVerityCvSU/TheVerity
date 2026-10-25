// C# Snippets and Language Completion Provider for Monaco Editor in The Verity
import * as monaco from 'monaco-editor';

export const CSHARP_SNIPPETS = [
  // --- Console I/O ---
  {
    label: 'cw',
    detail: 'Console.WriteLine();',
    documentation: 'Prints a line of text to standard output.',
    insertText: 'Console.WriteLine(${1:});',
  },
  {
    label: 'cwrite',
    detail: 'Console.Write();',
    documentation: 'Prints text to standard output without appending a line break.',
    insertText: 'Console.Write(${1:});',
  },
  {
    label: 'cr',
    detail: 'Console.ReadLine()',
    documentation: 'Reads the next line of input from standard input.',
    insertText: 'Console.ReadLine()',
  },
  {
    label: 'crl',
    detail: 'Console.ReadLine();',
    documentation: 'Reads the next line of characters from standard input as a standalone statement.',
    insertText: 'Console.ReadLine();',
  },
  {
    label: 'ck',
    detail: 'Console.ReadKey();',
    documentation: 'Reads the next character or function key pressed by user.',
    insertText: 'Console.ReadKey();',
  },
  {
    label: 'cclr',
    detail: 'Console.Clear();',
    documentation: 'Clears console buffer and output.',
    insertText: 'Console.Clear();',
  },

  // --- Program Entry & Boilerplate ---
  {
    label: 'sim',
    detail: 'static void Main(string[] args)',
    documentation: 'Standard C# static void Main entry point method.',
    insertText: 'static void Main(string[] args)\n{\n\t${0}\n}',
  },
  {
    label: 'svm',
    detail: 'static void Main(string[] args)',
    documentation: 'Standard C# static void Main entry point method.',
    insertText: 'static void Main(string[] args)\n{\n\t${0}\n}',
  },
  {
    label: 'main',
    detail: 'static void Main(string[] args)',
    documentation: 'Standard C# static void Main entry point method.',
    insertText: 'static void Main(string[] args)\n{\n\t${0}\n}',
  },
  {
    label: 'psvm',
    detail: 'public static void Main(string[] args)',
    documentation: 'Public static void Main entry point.',
    insertText: 'public static void Main(string[] args)\n{\n\t${0}\n}',
  },
  {
    label: 'boiler',
    detail: 'C# Console Program Template',
    documentation: 'Complete working boilerplate template for C# Console application.',
    insertText: 'using System;\n\nnamespace ${1:ProgramApp}\n{\n\tclass Program\n\t{\n\t\tstatic void Main(string[] args)\n\t\t{\n\t\t\tConsole.WriteLine("Hello, World!");\n\t\t\t${0}\n\t\t}\n\t}\n}',
  },
  {
    label: 'program',
    detail: 'C# Program Class with Main',
    documentation: 'Class Program with static void Main entry point.',
    insertText: 'using System;\n\nclass Program\n{\n\tstatic void Main(string[] args)\n\t{\n\t\t${0}\n\t}\n}',
  },

  // --- Loops & Iteration ---
  {
    label: 'for',
    detail: 'for (int i = 0; i < length; i++)',
    documentation: 'Standard for loop counting from 0 to length.',
    insertText: 'for (int ${1:i} = 0; ${1:i} < ${2:length}; ${1:i}++)\n{\n\t${0}\n}',
  },
  {
    label: 'forr',
    detail: 'for (int i = length - 1; i >= 0; i--)',
    documentation: 'Reverse for loop decrementing down to 0.',
    insertText: 'for (int ${1:i} = ${2:length} - 1; ${1:i} >= 0; ${1:i}--)\n{\n\t${0}\n}',
  },
  {
    label: 'foreach',
    detail: 'foreach (var item in collection)',
    documentation: 'Iterates through each element in an enumerable collection or array.',
    insertText: 'foreach (var ${1:item} in ${2:collection})\n{\n\t${0}\n}',
  },
  {
    label: 'fore',
    detail: 'foreach (var item in collection)',
    documentation: 'Shortcut for foreach loop.',
    insertText: 'foreach (var ${1:item} in ${2:collection})\n{\n\t${0}\n}',
  },
  {
    label: 'while',
    detail: 'while (condition)',
    documentation: 'Standard while loop.',
    insertText: 'while (${1:condition})\n{\n\t${0}\n}',
  },
  {
    label: 'do',
    detail: 'do { ... } while (condition);',
    documentation: 'Do-while loop that executes the block at least once before checking the condition.',
    insertText: 'do\n{\n\t${0}\n} while (${1:condition});',
  },

  // --- Conditionals & Branches ---
  {
    label: 'if',
    detail: 'if (condition)',
    documentation: 'If statement executing code when condition is true.',
    insertText: 'if (${1:condition})\n{\n\t${0}\n}',
  },
  {
    label: 'ifelse',
    detail: 'if (condition) { } else { }',
    documentation: 'If-else branch statement.',
    insertText: 'if (${1:condition})\n{\n\t${2}\n}\nelse\n{\n\t${0}\n}',
  },
  {
    label: 'else',
    detail: 'else { ... }',
    documentation: 'Else statement block.',
    insertText: 'else\n{\n\t${0}\n}',
  },
  {
    label: 'elif',
    detail: 'else if (condition)',
    documentation: 'Else-if condition branch.',
    insertText: 'else if (${1:condition})\n{\n\t${0}\n}',
  },
  {
    label: 'switch',
    detail: 'switch (expression) { case: ... }',
    documentation: 'Switch statement with case and default branch.',
    insertText: 'switch (${1:switch_on})\n{\n\tcase ${2:value}:\n\t\t${0}\n\t\tbreak;\n\tdefault:\n\t\tbreak;\n}',
  },
  {
    label: 'case',
    detail: 'case value: ... break;',
    documentation: 'Case clause inside a switch statement.',
    insertText: 'case ${1:value}:\n\t${0}\n\tbreak;',
  },

  // --- Classes, Types & OOP ---
  {
    label: 'class',
    detail: 'class MyClass { ... }',
    documentation: 'Declares a class definition.',
    insertText: 'class ${1:ClassName}\n{\n\t${0}\n}',
  },
  {
    label: 'pclass',
    detail: 'public class MyClass { ... }',
    documentation: 'Declares a public class.',
    insertText: 'public class ${1:ClassName}\n{\n\t${0}\n}',
  },
  {
    label: 'struct',
    detail: 'struct MyStruct { ... }',
    documentation: 'Declares a struct definition.',
    insertText: 'struct ${1:MyStruct}\n{\n\t${0}\n}',
  },
  {
    label: 'interface',
    detail: 'interface IMyInterface { ... }',
    documentation: 'Declares an interface definition.',
    insertText: 'interface I${1:MyInterface}\n{\n\t${0}\n}',
  },
  {
    label: 'enum',
    detail: 'enum MyEnum { ... }',
    documentation: 'Declares an enumeration.',
    insertText: 'enum ${1:MyEnum}\n{\n\t${0}\n}',
  },
  {
    label: 'ctor',
    detail: 'public Constructor()',
    documentation: 'Constructor definition for class.',
    insertText: 'public ${1:ClassName}()\n{\n\t${0}\n}',
  },
  {
    label: 'prop',
    detail: 'public Type Property { get; set; }',
    documentation: 'Auto-implemented property with getter and setter.',
    insertText: 'public ${1:int} ${2:MyProperty} { get; set; }',
  },
  {
    label: 'propg',
    detail: 'public Type Property { get; private set; }',
    documentation: 'Property with public getter and private setter.',
    insertText: 'public ${1:int} ${2:MyProperty} { get; private set; }',
  },
  {
    label: 'propfull',
    detail: 'Property with backing private field',
    documentation: 'Full property definition with backing variable.',
    insertText: 'private ${1:int} _${2:myVar};\npublic ${1:int} ${3:MyProperty}\n{\n\tget => _${2:myVar};\n\tset => _${2:myVar} = value;\n}',
  },

  // --- Methods ---
  {
    label: 'method',
    detail: 'public void MethodName()',
    documentation: 'Public void method definition.',
    insertText: 'public ${1:void} ${2:MethodName}(${3:})\n{\n\t${0}\n}',
  },
  {
    label: 'func',
    detail: 'public ReturnType Function()',
    documentation: 'Public method returning a value.',
    insertText: 'public ${1:int} ${2:Calculate}(${3:})\n{\n\treturn ${0};\n}',
  },
  {
    label: 'override',
    detail: 'public override string ToString()',
    documentation: 'Override method implementation.',
    insertText: 'public override ${1:string} ToString()\n{\n\treturn ${0};\n}',
  },
  {
    label: 'async',
    detail: 'public async Task MethodAsync()',
    documentation: 'Asynchronous method definition returning a Task.',
    insertText: 'public async Task ${1:DoWorkAsync}(${2:})\n{\n\t${0}\n}',
  },

  // --- Exception Handling ---
  {
    label: 'try',
    detail: 'try { ... } catch (Exception ex) { ... }',
    documentation: 'Try-catch block for structured exception handling.',
    insertText: 'try\n{\n\t${1}\n}\ncatch (Exception ex)\n{\n\t${0}\n}',
  },
  {
    label: 'tryf',
    detail: 'try { ... } finally { ... }',
    documentation: 'Try-finally block.',
    insertText: 'try\n{\n\t${1}\n}\nfinally\n{\n\t${0}\n}',
  },
  {
    label: 'catch',
    detail: 'catch (Exception ex) { ... }',
    documentation: 'Catch block.',
    insertText: 'catch (${1:Exception} ${2:ex})\n{\n\t${0}\n}',
  },
  {
    label: 'throw',
    detail: 'throw new Exception("...");',
    documentation: 'Throws a new exception.',
    insertText: 'throw new ${1:Exception}("${2:Error message}");',
  },

  // --- Input Parsing & Conversions ---
  {
    label: 'intparse',
    detail: 'int.Parse(Console.ReadLine())',
    documentation: 'Parses an integer from Console input.',
    insertText: 'int ${1:num} = int.Parse(Console.ReadLine() ?? "0");',
  },
  {
    label: 'doubleparse',
    detail: 'double.Parse(Console.ReadLine())',
    documentation: 'Parses a double floating-point number from Console input.',
    insertText: 'double ${1:num} = double.Parse(Console.ReadLine() ?? "0");',
  },
  {
    label: 'convert',
    detail: 'Convert.ToInt32(Console.ReadLine())',
    documentation: 'Converts input from Console.ReadLine() into 32-bit integer.',
    insertText: 'int ${1:num} = Convert.ToInt32(Console.ReadLine());',
  },
  {
    label: 'tryparse',
    detail: 'int.TryParse(...)',
    documentation: 'Safely parses an integer with boolean validation.',
    insertText: 'if (int.TryParse(${1:Console.ReadLine()}, out int ${2:result}))\n{\n\t${0}\n}',
  },

  // --- Collections & Arrays ---
  {
    label: 'list',
    detail: 'List<T> list = new List<T>();',
    documentation: 'Creates a new generic List collection.',
    insertText: 'List<${1:string}> ${2:items} = new List<${1:string}>();',
  },
  {
    label: 'dict',
    detail: 'Dictionary<TKey, TValue> map = new ...;',
    documentation: 'Creates a new generic key-value Dictionary collection.',
    insertText: 'Dictionary<${1:string}, ${2:int}> ${3:map} = new Dictionary<${1:string}, ${2:int}>();',
  },
  {
    label: 'arr',
    detail: 'Type[] arr = new Type[size];',
    documentation: 'Creates a fixed-size 1D array.',
    insertText: '${1:int}[] ${2:arr} = new ${1:int}[${3:10}];',
  },
  {
    label: 'array',
    detail: 'Type[] arr = new Type[size];',
    documentation: 'Creates a fixed-size 1D array.',
    insertText: '${1:int}[] ${2:arr} = new ${1:int}[${3:10}];',
  },

  // --- Namespace & Using ---
  {
    label: 'using',
    detail: 'using Namespace;',
    documentation: 'Using directive to import a namespace.',
    insertText: 'using ${1:System};',
  },
  {
    label: 'usblock',
    detail: 'using (var res = new ...) { ... }',
    documentation: 'Using statement ensuring disposable resource cleanup.',
    insertText: 'using (${1:var resource = new Resource()})\n{\n\t${0}\n}',
  },
  {
    label: 'namespace',
    detail: 'namespace MyNamespace { ... }',
    documentation: 'Namespace declaration.',
    insertText: 'namespace ${1:MyNamespace}\n{\n\t${0}\n}',
  },
  {
    label: 'region',
    detail: '#region ... #endregion',
    documentation: 'Collapsible code region directive.',
    insertText: '#region ${1:MyRegion}\n${0}\n#endregion',
  },
];

export const CSHARP_KEYWORDS = [
  'abstract', 'as', 'async', 'await', 'base', 'bool', 'break', 'byte', 'case', 'catch',
  'char', 'checked', 'class', 'const', 'continue', 'decimal', 'default', 'delegate',
  'do', 'double', 'else', 'enum', 'event', 'explicit', 'extern', 'false', 'finally',
  'fixed', 'float', 'for', 'foreach', 'goto', 'if', 'implicit', 'in', 'int',
  'interface', 'internal', 'is', 'lock', 'long', 'namespace', 'new', 'null', 'object',
  'operator', 'out', 'override', 'params', 'private', 'protected', 'public', 'readonly',
  'ref', 'return', 'sbyte', 'sealed', 'short', 'sizeof', 'stackalloc', 'static', 'string',
  'struct', 'switch', 'this', 'throw', 'true', 'try', 'typeof', 'uint', 'ulong',
  'unchecked', 'unsafe', 'ushort', 'using', 'virtual', 'void', 'volatile', 'while'
];

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
