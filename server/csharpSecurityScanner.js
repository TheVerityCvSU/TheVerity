/**
 * C# Security Scanner & Static Analysis Sandbox for The Verity.
 * Inspects untrusted C# student code prior to Roslyn/dotnet compilation.
 * 
 * Accurately detects:
 * - Process spawning (Process.Start, ProcessStartInfo, cmd.exe, powershell)
 * - Dynamic reflection / sandbox evasion (Type.GetType, MethodInfo, Assembly.Load)
 * - Native interop & unmanaged memory ([DllImport], Marshal, unsafe blocks)
 * - Network access (System.Net, HttpClient, Socket, TcpClient)
 * - System/Registry tampering (Registry, RegistryKey, Environment.Exit, AppDomain)
 * - Filesystem escape (absolute disk paths like C:\..., directory traversal ..\)
 * 
 * Features:
 * - Strips single-line and multi-line comments to avoid false positives.
 * - Extracts strings for focused command inspection without false-flagging innocent prints.
 * - Preserves exact line numbers and column offsets for Monaco editor diagnostic squiggles.
 */

/**
 * Decodes C# Unicode escape sequences (\uXXXX, \UXXXXXXXX) so obfuscated identifiers
 * or strings like `Fil\u0065` are normalized before pattern matching.
 */
function decodeCSharpUnicodeEscapes(code) {
  return String(code)
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/\\U([0-9a-fA-F]{8})/g, (_, hex) => {
      const cp = parseInt(hex, 16);
      return cp <= 0x10ffff ? String.fromCodePoint(cp) : _;
    })
    .replace(/\\x([0-9a-fA-F]{1,4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

function maskCommentsAndStrings(code) {
  let maskedCode = '';
  let inLineComment = false;
  let inBlockComment = false;
  let inNormalString = false;
  let inVerbatimString = false;
  let rawStringQuotes = 0; // C# 11+ raw string literals (3+ consecutive double quotes)
  const strings = [];

  let currentString = '';
  let stringStartLine = 1;
  let stringStartCol = 1;
  let line = 1;
  let col = 0;

  for (let i = 0; i < code.length; i++) {
    const ch = code[i];
    const next = code[i + 1] || '';

    if (ch === '\n') {
      line++;
      col = 0;
    } else {
      col++;
    }

    if (inLineComment) {
      if (ch === '\n') {
        inLineComment = false;
        maskedCode += '\n';
      } else {
        maskedCode += ' ';
      }
      continue;
    }

    if (inBlockComment) {
      if (ch === '*' && next === '/') {
        inBlockComment = false;
        maskedCode += '  ';
        i++;
        col++;
      } else {
        maskedCode += ch === '\n' ? '\n' : ' ';
      }
      continue;
    }

    if (rawStringQuotes > 0) {
      if (ch === '"') {
        let count = 1;
        while (code[i + count] === '"') count++;
        if (count >= rawStringQuotes) {
          maskedCode += '"'.repeat(rawStringQuotes);
          strings.push({ value: currentString, line: stringStartLine, col: stringStartCol });
          currentString = '';
          i += rawStringQuotes - 1;
          col += rawStringQuotes - 1;
          rawStringQuotes = 0;
          continue;
        }
      }
      currentString += ch;
      maskedCode += ch === '\n' ? '\n' : ' ';
      continue;
    }

    if (inVerbatimString) {
      if (ch === '"' && next === '"') {
        currentString += '""';
        maskedCode += '  ';
        i++;
        col++;
      } else if (ch === '"') {
        inVerbatimString = false;
        maskedCode += '"';
        strings.push({ value: currentString, line: stringStartLine, col: stringStartCol });
        currentString = '';
      } else {
        currentString += ch;
        maskedCode += ch === '\n' ? '\n' : ' ';
      }
      continue;
    }

    if (inNormalString) {
      if (ch === '\\') {
        currentString += ch + next;
        maskedCode += '  ';
        i++;
        col++;
      } else if (ch === '"') {
        inNormalString = false;
        maskedCode += '"';
        strings.push({ value: currentString, line: stringStartLine, col: stringStartCol });
        currentString = '';
      } else {
        currentString += ch;
        maskedCode += ch === '\n' ? '\n' : ' ';
      }
      continue;
    }

    if (ch === '/' && next === '/') {
      inLineComment = true;
      maskedCode += '  ';
      i++;
      col++;
      continue;
    }
    if (ch === '/' && next === '*') {
      inBlockComment = true;
      maskedCode += '  ';
      i++;
      col++;
      continue;
    }
    // Verbatim interpolated strings: $@"..." or @$"..."
    if (((ch === '$' && next === '@') || (ch === '@' && next === '$')) && code[i + 2] === '"') {
      inVerbatimString = true;
      stringStartLine = line;
      stringStartCol = col;
      maskedCode += '   ';
      i += 2;
      col += 2;
      continue;
    }
    // C# 11+ raw string literals: """...""" or $"""..."""
    if (ch === '"' && next === '"' && code[i + 2] === '"') {
      let count = 3;
      while (code[i + count] === '"') count++;
      rawStringQuotes = count;
      stringStartLine = line;
      stringStartCol = col;
      maskedCode += ' '.repeat(count);
      i += count - 1;
      col += count - 1;
      continue;
    }
    if (ch === '@' && next === '"') {
      inVerbatimString = true;
      stringStartLine = line;
      stringStartCol = col;
      maskedCode += '  ';
      i++;
      col++;
      continue;
    }
    if (ch === '$' && next === '"') {
      inNormalString = true;
      stringStartLine = line;
      stringStartCol = col;
      maskedCode += '  ';
      i++;
      col++;
      continue;
    }
    if (ch === '"') {
      inNormalString = true;
      stringStartLine = line;
      stringStartCol = col;
      maskedCode += '"';
      continue;
    }

    maskedCode += ch;
  }

  return { maskedCode, strings };
}

const BANNED_CODE_PATTERNS = [
  { pattern: /\bSystem\s*\.\s*Diagnostics\s*\.\s*Process\b/i, rule: 'PROCESS_SPAWN', message: 'Restricted API: System.Diagnostics.Process is prohibited.' },
  { pattern: /\bProcess\s*\.\s*(Start|Kill|GetProcesses|GetCurrentProcess|EnterDebugMode)\b/i, rule: 'PROCESS_SPAWN', message: 'Restricted API: Process spawning or manipulation is prohibited.' },
  { pattern: /\bProcessStartInfo\b/i, rule: 'PROCESS_SPAWN', message: 'Restricted API: ProcessStartInfo is prohibited.' },
  { pattern: /\[\s*(DllImport|LibraryImport)\b/i, rule: 'NATIVE_INTEROP', message: 'Restricted API: Native DllImport/LibraryImport interop is prohibited.' },
  { pattern: /\bSystem\s*\.\s*Runtime\s*\.\s*InteropServices\b/i, rule: 'NATIVE_INTEROP', message: 'Restricted API: Native InteropServices are prohibited.' },
  { pattern: /\b(NativeLibrary|GCHandle|Marshal)\s*\./i, rule: 'NATIVE_INTEROP', message: 'Restricted API: Native memory/library interop is prohibited.' },
  { pattern: /\bSystem\s*\.\s*Runtime\s*\.\s*CompilerServices\s*\.\s*Unsafe\b/i, rule: 'UNSAFE_CODE', message: 'Restricted API: CompilerServices.Unsafe is prohibited.' },
  { pattern: /\bunsafe\b/i, rule: 'UNSAFE_CODE', message: 'Restricted API: Unsafe code blocks are prohibited.' },
  { pattern: /\bstackalloc\b/i, rule: 'UNSAFE_CODE', message: 'Restricted API: stackalloc memory allocation is prohibited.' },
  { pattern: /\busing\s+[A-Za-z_][A-Za-z0-9_]*\s*=\s*System\s*\.\s*(?:Diagnostics|IO|Net|Reflection|Runtime)\b/i, rule: 'NAMESPACE_ALIAS_BYPASS', message: 'Restricted API: Namespace aliases for restricted System APIs are prohibited.' },
  { pattern: /\bSystem\s*\.\s*Reflection\b/i, rule: 'REFLECTION', message: 'Restricted API: System.Reflection is prohibited.' },
  { pattern: /\bSystem\s*\.\s*Runtime\s*\.\s*Loader\b/i, rule: 'REFLECTION', message: 'Restricted API: AssemblyLoadContext/Runtime.Loader is prohibited.' },
  { pattern: /\bAssemblyLoadContext\b/i, rule: 'REFLECTION', message: 'Restricted API: Dynamic AssemblyLoadContext loading is prohibited.' },
  { pattern: /\bType\s*\.\s*GetType\b/i, rule: 'REFLECTION', message: 'Restricted API: Dynamic Type.GetType reflection is prohibited.' },
  { pattern: /\btypeof\s*\([^)]*\)\s*\.\s*Assembly\b/i, rule: 'REFLECTION', message: 'Restricted API: Inspecting Assembly metadata via typeof(...).Assembly is prohibited.' },
  { pattern: /\.\s*Assembly\s*\.\s*(GetType|GetTypes|GetExportedTypes|GetLoadedModules|GetModule|CreateInstance|EntryPoint|Location|CodeBase)\b/i, rule: 'REFLECTION', message: 'Restricted API: Assembly reflection is prohibited.' },
  { pattern: /\b(MethodInfo|ConstructorInfo|FieldInfo|PropertyInfo|MethodBase|ParameterInfo|DynamicMethod|AssemblyName|ModuleHandle|RuntimeMethodHandle|RuntimeTypeHandle)\b/i, rule: 'REFLECTION', message: 'Restricted API: Reflection metadata types are prohibited.' },
  { pattern: /\.\s*(GetMethod|GetMethods|GetConstructor|GetConstructors|GetField|GetFields|GetProperty|GetProperties|GetMember|GetMembers|InvokeMember)\s*\(/i, rule: 'REFLECTION', message: 'Restricted API: Reflective member lookup/invocation is prohibited.' },
  { pattern: /\b(System\s*\.\s*CodeDom|Microsoft\s*\.\s*CodeAnalysis|Microsoft\s*\.\s*CSharp)\b/i, rule: 'REFLECTION', message: 'Restricted API: Dynamic runtime compilation is prohibited.' },
  { pattern: /\bAssembly\s*\.\s*(Load|LoadFrom|LoadFile)\b/i, rule: 'REFLECTION', message: 'Restricted API: Dynamic Assembly loading is prohibited.' },
  { pattern: /\bActivator\s*\.\s*CreateInstance\b/i, rule: 'REFLECTION', message: 'Restricted API: Dynamic Activator is prohibited.' },
  { pattern: /\bSystem\s*\.\s*Net\b/i, rule: 'NETWORK_ACCESS', message: 'Restricted API: System.Net networking is prohibited.' },
  { pattern: /\b(HttpClient|TcpClient|UdpClient|WebClient|WebRequest|HttpWebRequest|Socket|TcpListener|RestClient)\b/i, rule: 'NETWORK_ACCESS', message: 'Restricted API: Network socket/HTTP calls are prohibited in sandbox.' },
  { pattern: /\bSystem\s*\.\s*IO\s*\.\s*(File|Directory|FileStream|StreamReader|StreamWriter|FileInfo|DirectoryInfo|DriveInfo|FileSystemWatcher|MemoryMappedFiles|Pipes|Compression)\b/i, rule: 'FILESYSTEM_IO', message: 'Restricted API: Direct filesystem, compression, or pipe I/O is prohibited in sandbox.' },
  { pattern: /\b(ZipFile|ZipArchive|GZipStream|DeflateStream)\b/i, rule: 'FILESYSTEM_IO', message: 'Restricted API: Archive/compression stream I/O is prohibited in sandbox.' },
  { pattern: /\b(XDocument|XmlDocument|XmlReader|XmlTextReader|XPathDocument|XmlUrlResolver)\b/i, rule: 'FILESYSTEM_IO', message: 'Restricted API: External XML loader/resolver APIs are prohibited in sandbox.' },
  { pattern: /\.\s*ReadXml\s*\(/i, rule: 'FILESYSTEM_IO', message: 'Restricted API: External XML DataSet/DataTable loading is prohibited in sandbox.' },
  { pattern: /\b(File|Directory)\s*\.\s*(Read|Write|Append|Open|Create|Delete|Move|Copy|Exists|GetFiles|GetDirectories|Enumerate|SetAttributes|Replace)\w*/i, rule: 'FILESYSTEM_IO', message: 'Restricted API: Direct filesystem access is prohibited in sandbox.' },
  { pattern: /\bnew\s+(FileStream|StreamReader|StreamWriter|FileInfo|DirectoryInfo|DriveInfo|FileSystemWatcher|NamedPipeClientStream|NamedPipeServerStream|ZipArchive|GZipStream|DeflateStream|XmlTextReader)\b/i, rule: 'FILESYSTEM_IO', message: 'Restricted API: Direct file/stream/pipe handles are prohibited in sandbox.' },
  { pattern: /\bMemoryMappedFile\b/i, rule: 'FILESYSTEM_IO', message: 'Restricted API: MemoryMappedFile is prohibited in sandbox.' },
  { pattern: /\bMicrosoft\s*\.\s*Win32\s*\.\s*Registry\b/i, rule: 'SYSTEM_TAMPER', message: 'Restricted API: Registry access is prohibited.' },
  { pattern: /\bRegistryKey\b/i, rule: 'SYSTEM_TAMPER', message: 'Restricted API: RegistryKey access is prohibited.' },
  { pattern: /\bEnvironment\s*\.\s*(GetEnvironmentVariable|GetEnvironmentVariables|SetEnvironmentVariable|GetFolderPath|MachineName|UserName|UserDomainName|CurrentDirectory|GetCommandLineArgs|CommandLine|OSVersion|GetLogicalDrives|ExpandEnvironmentVariables|SystemDirectory|ProcessPath|ProcessId|StackTrace)\b/i, rule: 'ENV_ACCESS', message: 'Restricted API: Reading or modifying host environment/OS paths is prohibited in sandbox.' },
  { pattern: /\b(RuntimeInformation|OperatingSystem)\s*\./i, rule: 'ENV_ACCESS', message: 'Restricted API: OS/runtime host fingerprinting is prohibited in sandbox.' },
  { pattern: /\bEnvironment\s*\.\s*Exit\b/i, rule: 'PROCESS_KILL', message: 'Restricted API: Environment.Exit is prohibited in classroom IDE.' },
  { pattern: /\bEnvironment\s*\.\s*FailFast\b/i, rule: 'PROCESS_KILL', message: 'Restricted API: Environment.FailFast is prohibited.' },
  { pattern: /\bAppDomain\s*\.\s*CurrentDomain\b/i, rule: 'SYSTEM_TAMPER', message: 'Restricted API: AppDomain manipulation is prohibited.' }
];

const BANNED_STRING_PATTERNS = [
  { pattern: /\bcmd(\.exe)?\b/i, rule: 'DANGEROUS_COMMAND', message: 'Forbidden command reference: "cmd.exe" is blocked.' },
  { pattern: /\bpowershell(\.exe)?\b/i, rule: 'DANGEROUS_COMMAND', message: 'Forbidden command reference: "powershell" is blocked.' },
  { pattern: /\b(bash|sh|certutil|curl|wget|cscript|wscript|mshta|rundll32)(\.exe)?\b/i, rule: 'DANGEROUS_COMMAND', message: 'Forbidden shell or execution utility reference is blocked.' },
  { pattern: /\b(shutdown|format|regedit)\b/i, rule: 'DANGEROUS_COMMAND', message: 'Forbidden system command is blocked in string literal.' },
  { pattern: /[a-zA-Z]:[\\/]/, rule: 'PATH_TRAVERSAL', message: 'Absolute file paths (e.g. C:\\...) are prohibited.' },
  { pattern: /\.\.[\\/]/, rule: 'PATH_TRAVERSAL', message: 'Directory traversal (..) is prohibited.' }
];

/**
 * Scans a single C# file.
 * Returns { isSafe: true } or { isSafe: false, rule, message, fileName, line, column }.
 */
function scanSingleFile(rawCode, fileName = 'Program.cs') {
  if (!rawCode || typeof rawCode !== 'string') return { isSafe: true };
  const code = decodeCSharpUnicodeEscapes(rawCode);

  const { maskedCode, strings } = maskCommentsAndStrings(code);
  const lines = code.split('\n');

  for (const check of BANNED_CODE_PATTERNS) {
    const match = check.pattern.exec(maskedCode);
    if (match) {
      const index = match.index;
      let curLen = 0;
      let lineNum = 1;
      let colNum = 1;

      for (let l = 0; l < lines.length; l++) {
        const lineLen = lines[l].length + 1;
        if (curLen + lineLen > index) {
          lineNum = l + 1;
          colNum = (index - curLen) + 1;
          break;
        }
        curLen += lineLen;
      }

      return {
        isSafe: false,
        rule: check.rule,
        message: check.message,
        fileName,
        line: lineNum,
        column: colNum
      };
    }
  }

  for (const strObj of strings) {
    for (const check of BANNED_STRING_PATTERNS) {
      if (check.pattern.test(strObj.value)) {
        return {
          isSafe: false,
          rule: check.rule,
          message: check.message,
          fileName,
          line: strObj.line,
          column: strObj.col
        };
      }
    }
  }

  // Also detect simple split-string literal concatenation (e.g., "po" + "wershell", "cmd" + ".exe")
  const foldedLiteralCode = code.replace(/"([^"\\\r\n]*)"(?:\s*\+\s*"([^"\\\r\n]*)")+/g, (match) => {
    const joined = Array.from(match.matchAll(/"([^"\\\r\n]*)"/g), m => m[1]).join('');
    for (const check of BANNED_STRING_PATTERNS) {
      if (check.pattern.test(joined)) return `"${joined}"`;
    }
    return match;
  });
  if (foldedLiteralCode !== code) {
    const folded = maskCommentsAndStrings(foldedLiteralCode);
    for (const strObj of folded.strings) {
      for (const check of BANNED_STRING_PATTERNS) {
        if (check.pattern.test(strObj.value)) {
          return {
            isSafe: false,
            rule: check.rule,
            message: check.message,
            fileName,
            line: strObj.line,
            column: strObj.col
          };
        }
      }
    }
  }

  return { isSafe: true };
}

/**
 * Scans all student files (Program.cs + any extraFiles).
 */
function scanCSharpCode(code, extraFiles = []) {
  // Check main Program.cs
  const mainResult = scanSingleFile(code, 'Program.cs');
  if (!mainResult.isSafe) return mainResult;

  // Check extraFiles
  if (Array.isArray(extraFiles)) {
    for (const file of extraFiles) {
      if (file && file.code) {
        const extraResult = scanSingleFile(file.code, file.name || 'ExtraFile.cs');
        if (!extraResult.isSafe) return extraResult;
      }
    }
  }

  return { isSafe: true };
}

module.exports = {
  scanCSharpCode,
  scanSingleFile
};

