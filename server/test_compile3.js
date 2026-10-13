const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const projectDir = path.join(__dirname, 'test_compiler_seq2');
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

// Program.cs has the initial code
const initialCode = `using System;
namespace HelloWorld
{
    class Program
    {
        static void Main(string[] args)
        {
            Console.WriteLine("Hello, World!");
        }
    }
}`;
fs.writeFileSync(path.join(projectDir, 'Program.cs'), initialCode);

// The user puts the top level statements in an extra file
const userCode = `// Modern C# Example (C# 9+ / .NET 6+)
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
foreach (string language in programmingLanguages) { Console.WriteLine($"- {language}"); }`;
fs.writeFileSync(path.join(projectDir, 'script.cs'), userCode);

try {
    execSync(`dotnet restore verity_base.csproj`, { cwd: projectDir });
    const out = execSync(`dotnet build --no-restore -v q -clp:NoSummary --disable-build-servers -p:WarningLevel=4 verity_base.csproj`, { cwd: projectDir, encoding: 'utf8', stdio: 'pipe' });
    console.log("Build Success:\n", out);
} catch (e) {
    console.error("Build Error:\n", e.stdout || e.message);
}
