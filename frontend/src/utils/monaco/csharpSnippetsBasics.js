// C# snippets (part 1): console, boilerplate, loops, and conditionals.
export const CSHARP_BASIC_SNIPPETS = [
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
];
