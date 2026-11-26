const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { exec, execSync } = require('child_process');
const dotnetManager = require('../dotnetManager');

const COMPILER_BASE_DIR = path.join(os.tmpdir(), 'verity_compiler_base_template');

const OFFLINE_DOTNET_ENV = {
    ...process.env,
    DOTNET_CLI_TELEMETRY_OPTOUT: '1',
    DOTNET_NOLOGO: '1',
    DOTNET_SKIP_FIRST_TIME_EXPERIENCE: '1',
    DOTNET_CLI_UI_LANGUAGE: 'en-US',
    NUGET_CERTREVOCATIONMODE: 'offline',
    DOTNET_MULTILEVEL_LOOKUP: '0',
    DOTNET_GENERATE_ASPNET_CERTIFICATE: '0',
    POWERSHELL_TELEMETRY_OPTOUT: '1'
};

const OFFLINE_NUGET_CONFIG = `<?xml version="1.0" encoding="utf-8"?>
<configuration>
  <packageSources>
    <clear />
  </packageSources>
</configuration>
`;

/**
 * Terminates a child process along with any spawned descendant processes.
 */
function killProcessTree(proc) {
    if (!proc || !proc.pid) return;
    try {
        if (process.platform === 'win32') {
            exec(`taskkill /F /T /PID ${proc.pid}`, { stdio: 'ignore' }, () => { });
        } else {
            proc.kill('SIGKILL');
        }
    } catch (_) {
        try { proc.kill(); } catch (__) { }
    }
}

function parseCompilerDiagnostics(output) {
    if (!output) return [];
    const diagnostics = [];
    const regex = /(?:^|\r?\n)(?:.*?[/\\])?([a-zA-Z0-9_\-.]+?\.cs)\((\d+)(?:,(\d+))?(?:,(\d+),(\d+))?\):\s*(error|warning)\s+([A-Za-z0-9]+):\s*([^\r\n]+)/gi;
    let match;

    while ((match = regex.exec(output)) !== null) {
        const fileName = match[1];
        const startLine = parseInt(match[2], 10);
        const startCol = match[3] ? parseInt(match[3], 10) : 1;
        const endLine = match[4] ? parseInt(match[4], 10) : startLine;
        const endCol = match[5] ? parseInt(match[5], 10) : null;
        const severity = match[6].toLowerCase();
        const code = match[7];
        const rawMsg = match[8].trim().replace(/\s*\[.*?\.csproj\]$/, '').trim();

        diagnostics.push({
            file: fileName,
            severity,
            code,
            message: `${code}: ${rawMsg}`,
            startLineNumber: startLine,
            startColumn: startCol,
            endLineNumber: endLine,
            endColumn: endCol
        });
    }

    return diagnostics;
}

/**
 * Creates a minimal, secret-free environment with a 256 MB GC cap for sandboxed DLL runs.
 */
function createSandboxedRunEnv(sandboxRunDir) {
    const dotnetExe = dotnetManager.ensureDotnetInPath();
    const dotnetDir = dotnetExe ? path.dirname(dotnetExe) : (process.env.DOTNET_ROOT || (process.platform === 'win32' ? 'C:\\Program Files\\dotnet' : '/usr/share/dotnet'));
    const sysRoot = process.env.SystemRoot || process.env.WINDIR || 'C:\\Windows';
    const minimalPath = process.platform === 'win32'
        ? `${dotnetDir};${path.join(sysRoot, 'System32')};${sysRoot}`
        : `${dotnetDir}:/usr/local/bin:/usr/bin:/bin`;

    return {
        PATH: minimalPath,
        SystemRoot: sysRoot,
        WINDIR: sysRoot,
        DOTNET_ROOT: dotnetDir,
        DOTNET_CLI_TELEMETRY_OPTOUT: '1',
        DOTNET_NOLOGO: '1',
        DOTNET_EnableWriteXorExecute: '1',
        DOTNET_GCHeapHardLimit: '0x10000000',
        DOTNET_TieredCompilation: '0',
        TEMP: sandboxRunDir,
        TMP: sandboxRunDir,
        HOME: sandboxRunDir,
        USERPROFILE: sandboxRunDir,
        COMPlus_EnableDiagnostics: '0'
    };
}

function createEphemeralSandboxDir(prefix = 'verity_sandbox_') {
    const dir = path.join(os.tmpdir(), `${prefix}${Date.now()}_${crypto.randomBytes(4).toString('hex')}`);
    fs.mkdirSync(dir, { recursive: true });
    return dir;
}

function cleanupEphemeralSandboxDir(dir) {
    if (!dir) return;
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) { }
}

/**
 * Manages cached .NET SDK discovery, offline Roslyn compilation templates, and workspace state.
 */
function createCompilerService() {
    let baseTemplatePromise = null;
    let cachedDotnetTargetFramework = null;
    let cachedRoslynConfig = null;
    const sessionWorkspaces = new Map();

    function resetDotnetCache() {
        cachedDotnetTargetFramework = null;
        cachedRoslynConfig = null;
        baseTemplatePromise = null;
        console.log('[Compiler] Invalidate and reset local .NET SDK cache');
    }

    function getDotnetTargetFramework() {
        dotnetManager.ensureDotnetInPath();
        if (cachedDotnetTargetFramework) return cachedDotnetTargetFramework;
        try {
            const output = execSync('dotnet --version', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], env: OFFLINE_DOTNET_ENV }).trim();
            const major = parseInt(output.split('.')[0], 10);
            if (!isNaN(major) && major >= 6) {
                cachedDotnetTargetFramework = `net${major}.0`;
                console.log(`[Compiler] Detected .NET SDK ${output} -> targeting ${cachedDotnetTargetFramework}`);
                return cachedDotnetTargetFramework;
            }
        } catch (e) {
            console.warn('[Compiler] Could not determine dotnet version, defaulting to net8.0:', e.message);
        }
        cachedDotnetTargetFramework = 'net8.0';
        return cachedDotnetTargetFramework;
    }

    function getRoslynConfig() {
        if (cachedRoslynConfig !== null) return cachedRoslynConfig;
        try {
            const info = execSync('dotnet --info', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], env: OFFLINE_DOTNET_ENV });
            let basePath = '';
            const match = info.match(/Base Path:\s*([^\r\n]+)/i);
            if (match && match[1]) basePath = match[1].trim();

            let cscPath = null;
            if (basePath) {
                const candidate1 = path.join(basePath, 'Roslyn', 'bincore', 'csc.dll');
                const candidate2 = path.join(basePath, 'Roslyn', 'bcl', 'csc.dll');
                const candidate3 = path.join(basePath, 'Roslyn', 'csc.dll');
                if (fs.existsSync(candidate1)) cscPath = candidate1;
                else if (fs.existsSync(candidate2)) cscPath = candidate2;
                else if (fs.existsSync(candidate3)) cscPath = candidate3;
            }

            let refDir = null;
            let packVersion = null;
            if (basePath) {
                const dotnetRoot = path.resolve(basePath, '..', '..');
                const packsRefDir = path.join(dotnetRoot, 'packs', 'Microsoft.NETCore.App.Ref');
                if (fs.existsSync(packsRefDir)) {
                    const versions = fs.readdirSync(packsRefDir).filter(v => fs.existsSync(path.join(packsRefDir, v, 'ref')));
                    if (versions.length > 0) {
                        versions.sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
                        packVersion = versions[0];
                        const major = packVersion.split('.')[0];
                        const targetSub = path.join(packsRefDir, packVersion, 'ref', `net${major}.0`);
                        if (fs.existsSync(targetSub)) refDir = targetSub;
                    }
                }
            }

            if (cscPath && refDir) {
                cachedRoslynConfig = { cscPath, refDir, packVersion };
                console.log(`[Fast Compiler] Discovered local .NET SDK Roslyn C# engine:\n  Compiler: ${cscPath}\n  Reference Assemblies: ${refDir}`);
                return cachedRoslynConfig;
            }
        } catch (e) {
            console.warn('[Compiler] Could not locate direct Roslyn csc in local .NET SDK, will use optimized dotnet build:', e.message);
        }
        cachedRoslynConfig = false;
        return false;
    }

    function ensureBaseTemplate() {
        if (baseTemplatePromise) return baseTemplatePromise;

        baseTemplatePromise = (async () => {
            try {
                const targetFramework = getDotnetTargetFramework();
                const projectFile = path.join(COMPILER_BASE_DIR, 'verity_base.csproj');
                const nugetFile = path.join(COMPILER_BASE_DIR, 'nuget.config');
                const assetsFile = path.join(COMPILER_BASE_DIR, 'obj', 'project.assets.json');
                const rspFile = path.join(COMPILER_BASE_DIR, 'framework_refs.rsp');

                if (fs.existsSync(projectFile) && fs.existsSync(assetsFile) && fs.existsSync(nugetFile)) {
                    try {
                        const existingContent = fs.readFileSync(projectFile, 'utf8');
                        if (existingContent.includes(`<TargetFramework>${targetFramework}</TargetFramework>`)) {
                            try {
                                if (fs.readFileSync(nugetFile, 'utf8').includes('api.nuget.org')) {
                                    fs.writeFileSync(nugetFile, OFFLINE_NUGET_CONFIG, 'utf8');
                                }
                            } catch (_) { }
                            return COMPILER_BASE_DIR;
                        }
                    } catch (_) { }
                    try { fs.rmSync(COMPILER_BASE_DIR, { recursive: true, force: true }); } catch (_) { }
                }

                if (!fs.existsSync(COMPILER_BASE_DIR)) {
                    fs.mkdirSync(COMPILER_BASE_DIR, { recursive: true });
                }

                const csprojContent = `<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <OutputType>Exe</OutputType>
    <TargetFramework>${targetFramework}</TargetFramework>
    <ImplicitUsings>enable</ImplicitUsings>
    <Nullable>enable</Nullable>
    <UseAppHost>false</UseAppHost>
    <UseSharedCompilation>true</UseSharedCompilation>
    <ProduceReferenceAssembly>false</ProduceReferenceAssembly>
    <EnableSourceLink>false</EnableSourceLink>
    <EnableSourceControlManagerQueries>false</EnableSourceControlManagerQueries>
    <RunAnalyzers>false</RunAnalyzers>
    <EnableNETAnalyzers>false</EnableNETAnalyzers>
    <SatelliteResourceLanguages>none</SatelliteResourceLanguages>
    <AcceleratedBuildsInVisualStudio>true</AcceleratedBuildsInVisualStudio>
    <NoWarn>$(NoWarn);NU1503;CS7022</NoWarn>
  </PropertyGroup>
</Project>
`;
                fs.writeFileSync(projectFile, csprojContent, 'utf8');
                fs.writeFileSync(nugetFile, OFFLINE_NUGET_CONFIG, 'utf8');
                fs.writeFileSync(path.join(COMPILER_BASE_DIR, 'Program.cs'), 'using System; class Program { static void Main() {} }\n', 'utf8');

                const roslyn = getRoslynConfig();
                if (roslyn && roslyn.refDir) {
                    try {
                        const dlls = fs.readdirSync(roslyn.refDir).filter(f => f.endsWith('.dll'));
                        const rspLines = [
                            '-nologo', '-target:exe', '-nullable:enable', '-parallel+',
                            ...dlls.map(d => `"-r:${path.join(roslyn.refDir, d)}"`)
                        ];
                        fs.writeFileSync(rspFile, rspLines.join('\r\n'), 'utf8');

                        const binDir = path.join(COMPILER_BASE_DIR, 'bin', 'Debug', targetFramework);
                        fs.mkdirSync(binDir, { recursive: true });
                        const runtimeConfig = {
                            runtimeOptions: {
                                tfm: targetFramework,
                                framework: { name: 'Microsoft.NETCore.App', version: roslyn.packVersion || '8.0.0' }
                            }
                        };
                        fs.writeFileSync(path.join(binDir, 'verity_base.runtimeconfig.json'), JSON.stringify(runtimeConfig, null, 2), 'utf8');
                    } catch (rspErr) {
                        console.warn('[Compiler] Could not generate framework_refs.rsp:', rspErr.message);
                    }
                }

                console.log(`[Compiler] Pre-warming base .NET template (${targetFramework}) in offline mode...`);
                await new Promise((resolve) => {
                    exec(`dotnet restore "${projectFile}" --ignore-failed-sources -v q`, { cwd: COMPILER_BASE_DIR, env: OFFLINE_DOTNET_ENV }, (restoreErr) => {
                        if (restoreErr) {
                            console.warn('[Compiler] Base template restore warning:', restoreErr.message);
                        }
                        exec(`dotnet build --no-restore -v q -m -p:WarningLevel=0 -p:UseAppHost=false "${projectFile}"`, { cwd: COMPILER_BASE_DIR, env: OFFLINE_DOTNET_ENV }, (buildErr) => {
                            if (buildErr) {
                                console.warn('[Compiler] Base template build warning (falling back to standard build):', buildErr.message);
                                exec(`dotnet build -v q -m -p:WarningLevel=0 "${projectFile}"`, { cwd: COMPILER_BASE_DIR, env: OFFLINE_DOTNET_ENV }, () => resolve(COMPILER_BASE_DIR));
                            } else {
                                console.log(`[Compiler] Base .NET template pre-warmed for ${targetFramework} with warm obj/bin cache (offline ready).`);
                                resolve(COMPILER_BASE_DIR);
                            }
                        });
                    });
                });

                return COMPILER_BASE_DIR;
            } catch (err) {
                console.error('Failed to pre-warm base compiler template:', err);
                baseTemplatePromise = null;
                throw err;
            }
        })();

        return baseTemplatePromise;
    }

    function getCompilerSpawnConfig(projectDir, treatWarningsAsErrors, extraFiles = []) {
        const targetFramework = getDotnetTargetFramework();
        const binDir = path.join(projectDir, 'bin', 'Debug', targetFramework);
        const dllPath = path.join(binDir, 'verity_base.dll');
        const roslyn = getRoslynConfig();

        if (roslyn && roslyn.cscPath && roslyn.refDir) {
            if (!fs.existsSync(binDir)) {
                fs.mkdirSync(binDir, { recursive: true });
            }

            const runtimeConfigFile = path.join(binDir, 'verity_base.runtimeconfig.json');
            if (!fs.existsSync(runtimeConfigFile)) {
                const runtimeConfig = {
                    runtimeOptions: {
                        tfm: targetFramework,
                        framework: { name: 'Microsoft.NETCore.App', version: roslyn.packVersion || '8.0.0' }
                    }
                };
                fs.writeFileSync(runtimeConfigFile, JSON.stringify(runtimeConfig, null, 2), 'utf8');
            }

            const rspFile = path.join(projectDir, 'framework_refs.rsp');
            if (!fs.existsSync(rspFile)) {
                const dlls = fs.readdirSync(roslyn.refDir).filter(f => f.endsWith('.dll'));
                const rspLines = [
                    '-nologo', '-target:exe', '-nullable:enable', '-parallel+',
                    ...dlls.map(d => `"-r:${path.join(roslyn.refDir, d)}"`)
                ];
                fs.writeFileSync(rspFile, rspLines.join('\r\n'), 'utf8');
            }

            const sourceFiles = [
                path.join(projectDir, 'Program.cs'),
                ...extraFiles.map(ef => {
                    const safeName = ef.name.replace(/[^a-zA-Z0-9_\-.]/g, '_').replace(/\.cs$/i, '') + '.cs';
                    return path.join(projectDir, safeName);
                }).filter(p => fs.existsSync(p) && path.basename(p).toLowerCase() !== 'program.cs')
            ];

            const args = [
                'exec', roslyn.cscPath, `@${rspFile}`, `-out:${dllPath}`,
                treatWarningsAsErrors ? '-warnaserror+' : '-warnaserror-',
                treatWarningsAsErrors ? '-warn:4' : '-warn:0',
                ...sourceFiles
            ];

            return { command: 'dotnet', args, dllPath, mode: 'roslyn-direct' };
        }

        const projectFile = path.join(projectDir, 'verity_base.csproj');
        const args = [
            'build', '--no-restore', '-v', 'q', '-clp:NoSummary', '-m',
            '-p:UseAppHost=false', '-p:ProduceReferenceAssembly=false', '-p:RunAnalyzers=false',
            treatWarningsAsErrors ? '-p:WarningLevel=4' : '-p:WarningLevel=0',
            ...(treatWarningsAsErrors ? ['-p:TreatWarningsAsErrors=true'] : []),
            projectFile
        ];

        return { command: 'dotnet', args, dllPath, mode: 'dotnet-build' };
    }

    return {
        COMPILER_BASE_DIR,
        OFFLINE_DOTNET_ENV,
        OFFLINE_NUGET_CONFIG,
        sessionWorkspaces,
        resetDotnetCache,
        getDotnetTargetFramework,
        getRoslynConfig,
        ensureBaseTemplate,
        getCompilerSpawnConfig,
        killProcessTree,
        parseCompilerDiagnostics,
        createSandboxedRunEnv,
        createEphemeralSandboxDir,
        cleanupEphemeralSandboxDir
    };
}

module.exports = {
    createCompilerService,
    COMPILER_BASE_DIR,
    OFFLINE_DOTNET_ENV,
    OFFLINE_NUGET_CONFIG,
    killProcessTree,
    parseCompilerDiagnostics,
    createSandboxedRunEnv,
    createEphemeralSandboxDir,
    cleanupEphemeralSandboxDir
};
