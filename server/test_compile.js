const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const projectDir = path.join(__dirname, 'test_compiler_dir');
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

const code = `// Modern C# Example (C# 9+ / .NET 6+)
using System;

// 1. Output basic text to the console
Console.WriteLine("Welcome to C#!");

// 2. Variables and Type Safety
string userName = "Alice";
int birthYear = 1995;
int currentYear = DateTime.Now.Year;
int age = currentYear - birthYear;

// 3. String Interpolation
Console.WriteLine($"Hello {userName}, you are approximately {age} years old.");

// 4. Conditional Logic (If-Else)
if (age >= 18)
{
    Console.WriteLine("You are an adult.");
}
else
{
    Console.WriteLine("You are a minor.");
}

// 5. Loops (Foreach)
string[] programmingLanguages = { "C#", "Python", "Java", "C++" };
Console.WriteLine("\\nHere is a list of programming languages:");

foreach (string language in programmingLanguages)
{
    Console.WriteLine($"- {language}");
}`;

fs.writeFileSync(path.join(projectDir, 'verity_base.csproj'), csprojContent);
fs.writeFileSync(path.join(projectDir, 'Program.cs'), code);

try {
    console.log("Restoring...");
    execSync(`dotnet restore verity_base.csproj`, { cwd: projectDir, stdio: 'inherit' });
    console.log("Building...");
    const out = execSync(`dotnet build --no-restore -v q -clp:NoSummary --disable-build-servers -p:WarningLevel=4 verity_base.csproj`, { cwd: projectDir, encoding: 'utf8' });
    console.log("Build Success:\n", out);
} catch (e) {
    console.error("Build Error:\n", e.stdout || e.message);
}
