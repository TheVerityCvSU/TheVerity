// Modern C# Example (C# 9+ / .NET 6+)
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
Console.WriteLine("\nHere is a list of programming languages:");

foreach (string language in programmingLanguages)
{
    Console.WriteLine($"- {language}");
}