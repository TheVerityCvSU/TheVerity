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

function maskCommentsAndStrings(code) {
  let maskedCode = '';
  let inLineComment = false;
  let inBlockComment = false;
  let inNormalString = false;
  let inVerbatimString = false;
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
  { pattern: /\bProcess\s*\.\s*(Start|Kill|GetProcesses)\b/i, rule: 'PROCESS_SPAWN', message: 'Restricted API: Process spawning or manipulation is prohibited.' },
  { pattern: /\bProcessStartInfo\b/i, rule: 'PROCESS_SPAWN', message: 'Restricted API: ProcessStartInfo is prohibited.' },
  { pattern: /\[\s*DllImport\b/i, rule: 'NATIVE_INTEROP', message: 'Restricted API: Native DllImport interop is prohibited.' },
  { pattern: /\bSystem\s*\.\s*Runtime\s*\.\s*InteropServices\b/i, rule: 'NATIVE_INTEROP', message: 'Restricted API: Native InteropServices are prohibited.' },
  { pattern: /\bunsafe\b/i, rule: 'UNSAFE_CODE', message: 'Restricted API: Unsafe code blocks are prohibited.' },
  { pattern: /\bSystem\s*\.\s*Reflection\b/i, rule: 'REFLECTION', message: 'Restricted API: System.Reflection is prohibited.' },
  { pattern: /\bType\s*\.\s*GetType\b/i, rule: 'REFLECTION', message: 'Restricted API: Dynamic Type.GetType reflection is prohibited.' },
  { pattern: /\bAssembly\s*\.\s*Load\b/i, rule: 'REFLECTION', message: 'Restricted API: Dynamic Assembly.Load reflection is prohibited.' },
  { pattern: /\bActivator\s*\.\s*CreateInstance\b/i, rule: 'REFLECTION', message: 'Restricted API: Dynamic Activator is prohibited.' },
  { pattern: /\bSystem\s*\.\s*Net\b/i, rule: 'NETWORK_ACCESS', message: 'Restricted API: System.Net networking is prohibited.' },
  { pattern: /\bHttpClient\b/i, rule: 'NETWORK_ACCESS', message: 'Restricted API: HttpClient network calls are prohibited.' },
  { pattern: /\bTcpClient\b/i, rule: 'NETWORK_ACCESS', message: 'Restricted API: TcpClient network calls are prohibited.' },
  { pattern: /\bUdpClient\b/i, rule: 'NETWORK_ACCESS', message: 'Restricted API: UdpClient network calls are prohibited.' },
  { pattern: /\bWebClient\b/i, rule: 'NETWORK_ACCESS', message: 'Restricted API: WebClient network calls are prohibited.' },
  { pattern: /\b(File|Directory)\s*\.\s*Delete\b/i, rule: 'DESTRUCTIVE_IO', message: 'Restricted API: File or directory deletion is prohibited.' },
  { pattern: /\bMicrosoft\s*\.\s*Win32\s*\.\s*Registry\b/i, rule: 'SYSTEM_TAMPER', message: 'Restricted API: Registry access is prohibited.' },
  { pattern: /\bRegistryKey\b/i, rule: 'SYSTEM_TAMPER', message: 'Restricted API: RegistryKey access is prohibited.' },
  { pattern: /\bEnvironment\s*\.\s*Exit\b/i, rule: 'PROCESS_KILL', message: 'Restricted API: Environment.Exit is prohibited in classroom IDE.' },
  { pattern: /\bEnvironment\s*\.\s*FailFast\b/i, rule: 'PROCESS_KILL', message: 'Restricted API: Environment.FailFast is prohibited.' },
  { pattern: /\bAppDomain\s*\.\s*CurrentDomain\b/i, rule: 'SYSTEM_TAMPER', message: 'Restricted API: AppDomain manipulation is prohibited.' }
];

const BANNED_STRING_PATTERNS = [
  { pattern: /\bcmd(\.exe)?\b/i, rule: 'DANGEROUS_COMMAND', message: 'Forbidden command reference: "cmd.exe" is blocked.' },
  { pattern: /\bpowershell(\.exe)?\b/i, rule: 'DANGEROUS_COMMAND', message: 'Forbidden command reference: "powershell" is blocked.' },
  { pattern: /\b(bash|sh|certutil|curl|wget|cscript|wscript|mshta|rundll32)(\.exe)?\b/i, rule: 'DANGEROUS_COMMAND', message: 'Forbidden shell or execution utility reference is blocked.' },
  { pattern: /\b(shutdown|format|regedit)\b/i, rule: 'DANGEROUS_COMMAND', message: 'Forbidden system command is blocked in string literal.' },
  { pattern: /^[a-zA-Z]:[\\/]/, rule: 'PATH_TRAVERSAL', message: 'Absolute file paths (e.g. C:\\...) are prohibited.' },
  { pattern: /\.\.[\\/]/, rule: 'PATH_TRAVERSAL', message: 'Directory traversal (..) is prohibited.' }
];

/**
 * Scans a single C# file.
 * Returns { isSafe: true } or { isSafe: false, rule, message, fileName, line, column }.
 */
function scanSingleFile(code, fileName = 'Program.cs') {
  if (!code || typeof code !== 'string') return { isSafe: true };

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

