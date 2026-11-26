// KioskLockHook — a native low-level keyboard hook that reliably blocks the
// Windows key and OS task-switching combos (Alt+Tab, Win+Tab, Alt+Esc, Ctrl+Esc,
// Alt+F4, Win+V) while a lock file exists, without interfering with normal Tab usage.
//
// Usage: KioskLockHook.exe <lockfile> [parentPid]
//   - While <lockfile> EXISTS  -> hook is ACTIVE (blocks escape shortcuts)
//   - While <lockfile> ABSENT  -> hook is PASSIVE (passes keys through)

using System;
using System.Diagnostics;
using System.IO;
using System.Runtime.InteropServices;

class KioskLockHook
{
    delegate IntPtr LowLevelKeyboardProc(int nCode, IntPtr wParam, IntPtr lParam);
    delegate void TimerProc(IntPtr hwnd, uint uMsg, IntPtr idEvent, uint dwTime);

    [DllImport("user32.dll", SetLastError = true)]
    static extern IntPtr SetWindowsHookEx(int idHook, LowLevelKeyboardProc lpfn, IntPtr hMod, uint dwThreadId);

    [DllImport("user32.dll", SetLastError = true)]
    static extern bool UnhookWindowsHookEx(IntPtr hhk);

    [DllImport("user32.dll")]
    static extern IntPtr CallNextHookEx(IntPtr hhk, int nCode, IntPtr wParam, IntPtr lParam);

    [DllImport("user32.dll")]
    static extern short GetAsyncKeyState(uint vKey);

    [DllImport("user32.dll")]
    static extern sbyte GetMessage(out MSG lpMsg, IntPtr hWnd, uint wMsgFilterMin, uint wMsgFilterMax);

    [DllImport("user32.dll")]
    static extern bool TranslateMessage(ref MSG lpMsg);

    [DllImport("user32.dll")]
    static extern IntPtr DispatchMessage(ref MSG lpMsg);

    [DllImport("user32.dll")]
    static extern IntPtr SetTimer(IntPtr hWnd, IntPtr nIDEvent, uint uElapse, TimerProc lpTimerFunc);

    [DllImport("user32.dll")]
    static extern bool KillTimer(IntPtr hWnd, IntPtr uIDEvent);

    [DllImport("user32.dll")]
    static extern void PostQuitMessage(int nExitCode);

    [DllImport("kernel32.dll", CharSet = CharSet.Auto, SetLastError = true)]
    static extern IntPtr GetModuleHandle(string lpModuleName);

    [StructLayout(LayoutKind.Sequential)]
    struct POINT
    {
        public int x;
        public int y;
    }

    [StructLayout(LayoutKind.Sequential)]
    struct MSG
    {
        public IntPtr hwnd;
        public uint message;
        public IntPtr wParam;
        public IntPtr lParam;
        public uint time;
        public POINT pt;
    }

    const int WH_KEYBOARD_LL = 13;
    const int WM_KEYDOWN = 0x0100;
    const int WM_KEYUP = 0x0101;
    const int WM_SYSKEYDOWN = 0x0104;
    const int WM_SYSKEYUP = 0x0105;

    const uint VK_LWIN = 0x5B;
    const uint VK_RWIN = 0x5C;
    const uint VK_TAB = 0x09;
    const uint VK_ESCAPE = 0x1B;
    const uint VK_MENU = 0x12;     // Alt
    const uint VK_CONTROL = 0x11;  // Ctrl
    const uint VK_F4 = 0x73;
    const uint VK_V = 0x56;

    [StructLayout(LayoutKind.Sequential)]
    struct KBDLLHOOKSTRUCT
    {
        public int vkCode;
        public int scanCode;
        public int flags;
        public int time;
        public IntPtr dwExtraInfo;
    }

    static readonly LowLevelKeyboardProc proc = HookCallback;
    static readonly TimerProc watchTimerProc = WatchdogTick;
    static IntPtr hookID = IntPtr.Zero;
    static IntPtr timerID = IntPtr.Zero;
    static volatile bool active = false;
    static string lockFile;
    static int parentPid = 0;

    static IntPtr HookCallback(int nCode, IntPtr wParam, IntPtr lParam)
    {
        if (nCode >= 0 && active)
        {
            int msg = wParam.ToInt32();
            if (msg == WM_KEYDOWN || msg == WM_SYSKEYDOWN || msg == WM_KEYUP || msg == WM_SYSKEYUP)
            {
                KBDLLHOOKSTRUCT kbd = (KBDLLHOOKSTRUCT)Marshal.PtrToStructure(lParam, typeof(KBDLLHOOKSTRUCT));
                if (IsBlocked(kbd.vkCode))
                {
                    return new IntPtr(1);
                }
            }
        }
        return CallNextHookEx(hookID, nCode, wParam, lParam);
    }

    static bool IsBlocked(int vkCode)
    {
        // Block bare Windows keys outright (Start menu & Win+* combinations).
        if (vkCode == (int)VK_LWIN || vkCode == (int)VK_RWIN)
            return true;

        // Block Win+V (Windows Clipboard History) even if modifier state lagged.
        if (vkCode == (int)VK_V && (IsDown(VK_LWIN) || IsDown(VK_RWIN)))
            return true;

        // Only block Tab when paired with Alt or Windows key — allow normal Tab indentation in editors/forms.
        if (vkCode == (int)VK_TAB && (IsDown(VK_MENU) || IsDown(VK_LWIN) || IsDown(VK_RWIN)))
            return true;

        // Block Alt+Esc, Ctrl+Esc (Start Menu), and Ctrl+Shift+Esc (Task Manager).
        if (vkCode == (int)VK_ESCAPE && (IsDown(VK_MENU) || IsDown(VK_CONTROL)))
            return true;

        // Block Alt+F4.
        if (vkCode == (int)VK_F4 && IsDown(VK_MENU))
            return true;

        return false;
    }

    static bool IsDown(uint vk)
    {
        return (GetAsyncKeyState(vk) & 0x8000) != 0;
    }

    static bool IsParentAlive()
    {
        if (parentPid <= 0) return true;
        try
        {
            Process parent = Process.GetProcessById(parentPid);
            return !parent.HasExited;
        }
        catch
        {
            return false;
        }
    }

    static void CleanupAndQuit()
    {
        active = false;
        try
        {
            if (!string.IsNullOrEmpty(lockFile) && File.Exists(lockFile))
            {
                File.Delete(lockFile);
            }
        }
        catch { }
        PostQuitMessage(0);
    }

    static void WatchdogTick(IntPtr hwnd, uint uMsg, IntPtr idEvent, uint dwTime)
    {
        if (!IsParentAlive())
        {
            CleanupAndQuit();
            return;
        }
        try
        {
            active = !string.IsNullOrEmpty(lockFile) && File.Exists(lockFile);
        }
        catch
        {
            active = false;
        }
    }

    [STAThread]
    static int Main(string[] args)
    {
        lockFile = args.Length > 0 ? args[0] : Path.Combine(Path.GetTempPath(), "verity_lock");
        if (args.Length > 1)
        {
            int parsed;
            if (int.TryParse(args[1], out parsed) && parsed > 0)
                parentPid = parsed;
        }

        string dir = Path.GetDirectoryName(lockFile);
        if (!string.IsNullOrEmpty(dir)) Directory.CreateDirectory(dir);
        active = File.Exists(lockFile);

        using (Process curProcess = Process.GetCurrentProcess())
        using (ProcessModule curModule = curProcess.MainModule)
        {
            hookID = SetWindowsHookEx(WH_KEYBOARD_LL, proc, GetModuleHandle(curModule.ModuleName), 0);
        }

        if (hookID == IntPtr.Zero)
        {
            return 1;
        }

        timerID = SetTimer(IntPtr.Zero, IntPtr.Zero, 250, watchTimerProc);

        MSG msg;
        while (GetMessage(out msg, IntPtr.Zero, 0, 0) > 0)
        {
            TranslateMessage(ref msg);
            DispatchMessage(ref msg);
        }

        if (timerID != IntPtr.Zero) KillTimer(IntPtr.Zero, timerID);
        if (hookID != IntPtr.Zero) UnhookWindowsHookEx(hookID);
        return 0;
    }
}
