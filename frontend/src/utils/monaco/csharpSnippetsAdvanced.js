// C# snippets (part 2): classes, methods, exceptions, parsing, collections, and namespaces.
export const CSHARP_ADVANCED_SNIPPETS = [
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
