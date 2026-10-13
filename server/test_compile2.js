const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const projectDir = path.join(__dirname, 'test_compiler_seq');
if (!fs.existsSync(projectDir)) fs.mkdirSync(projectDir);

const csprojContent = `<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <OutputType>Exe</OutputType>
    <TargetFramework>net10.0</TargetFramework>
    <ImplicitUsings>enable</ImplicitUsings>
    <Nullable>enable</Nullable>
    <NoWarn>$(NoWarn);NU1503</NoWarn>
  </PropertyGroup>
</Project>`;

fs.writeFileSync(path.join(projectDir, 'verity_base.csproj'), csprojContent);
// Initial pre-warm code
fs.writeFileSync(path.join(projectDir, 'Program.cs'), 'using System; class Program { static void Main() {} }\n');

try {
    console.log("Pre-warming...");
    execSync(`dotnet restore verity_base.csproj`, { cwd: projectDir });
    execSync(`dotnet build --no-restore -v q -clp:NoSummary -p:WarningLevel=0 verity_base.csproj`, { cwd: projectDir });
    
    console.log("Applying student top-level code...");
    const code = `// Modern C# Example (C# 9+ / .NET 6+)
using System;
Console.WriteLine("Welcome to C#!");
string userName = "Alice";
int birthYear = 1995;
int currentYear = DateTime.Now.Year;
int age = currentYear - birthYear;
Console.WriteLine($"Hello {userName}, you are approximately {age} years old.");
if (age >= 18) { Console.WriteLine("You are an adult."); } else { Console.WriteLine("You are a minor."); }
string[] programmingLanguages = { "C#", "Python", "Java", "C++" };
Console.WriteLine("\\nHere is a list of programming languages:");
foreach (string language in programmingLanguages) { Console.WriteLine($"- {language}"); }
`;
    fs.writeFileSync(path.join(projectDir, 'Program.cs'), code);
    
    console.log("Building student code...");
    const out = execSync(`dotnet build --no-restore -v q -clp:NoSummary --disable-build-servers -p:WarningLevel=4 verity_base.csproj`, { cwd: projectDir, encoding: 'utf8', stdio: 'pipe' });
    console.log("Build Success:\n", out);
} catch (e) {
    console.error("Build Error:\n", e.stdout || e.message);
}
