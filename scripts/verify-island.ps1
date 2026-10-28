<#
.SYNOPSIS
  Checks the running island window: styles, region, focus and click-through,
  then measures memory and idle CPU of Quiera and its WebView2 processes.

.DESCRIPTION
  Start Quiera first (release build recommended). The focus test opens a
  temporary "probe" window that takes focus, clicks the island, and checks the
  probe kept focus. The click-through test clicks inside the island window but
  outside the pill and checks the probe received the click. The mouse is moved
  for about two seconds, then put back.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts/verify-island.ps1
#>
param(
  [int]$CpuSampleSeconds = 30
)

$ErrorActionPreference = 'Stop'

Add-Type @'
using System;
using System.Text;
using System.Runtime.InteropServices;
public static class U {
  public delegate bool EnumProc(IntPtr h, IntPtr l);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc p, IntPtr l);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] public static extern int GetWindowRgnBox(IntPtr h, out RECT r);
  [DllImport("user32.dll")] public static extern IntPtr GetWindowLongPtr(IntPtr h, int i);
  [DllImport("user32.dll")] public static extern IntPtr WindowFromPoint(POINT p);
  [DllImport("user32.dll")] public static extern IntPtr GetAncestor(IntPtr h, uint flags);
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern bool GetCursorPos(out POINT p);
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
  [DllImport("user32.dll")] public static extern void mouse_event(uint f, int x, int y, uint d, UIntPtr e);
  [DllImport("user32.dll")] public static extern IntPtr SetProcessDpiAwarenessContext(IntPtr c);
  public struct RECT { public int L, T, R, B; }
  public struct POINT { public int X, Y; public POINT(int x, int y) { X = x; Y = y; } }
}
'@

# Physical pixels everywhere, whatever the display scale.
[void][U]::SetProcessDpiAwarenessContext([IntPtr](-4))

$results = New-Object System.Collections.Generic.List[object]
function Check([string]$name, [bool]$ok, [string]$detail = '') {
  $results.Add([pscustomobject]@{ Check = $name; Result = $(if ($ok) { 'OK' } else { 'ECHEC' }); Detail = $detail })
}

# --- Find the island window -------------------------------------------------
$proc = Get-Process quiera -ErrorAction SilentlyContinue |
  Where-Object { $_.Path -like '*\src-tauri\target\*' } | Select-Object -First 1
if (-not $proc) { throw 'Quiera (src-tauri\target build) is not running.' }

$script:island = [IntPtr]::Zero
$cb = [U+EnumProc] {
  param($h, $l)
  $procId = 0; [void][U]::GetWindowThreadProcessId($h, [ref]$procId)
  if ($procId -eq $proc.Id -and [U]::IsWindowVisible($h)) {
    $sb = New-Object System.Text.StringBuilder 64
    [void][U]::GetWindowText($h, $sb, 64)
    if ($sb.ToString() -eq 'Quiera') { $script:island = $h; return $false }
  }
  return $true
}
[void][U]::EnumWindows($cb, [IntPtr]::Zero)
if ($script:island -eq [IntPtr]::Zero) { throw 'Island window not found (is it visible?).' }
$island = $script:island

# --- Styles -----------------------------------------------------------------
$ex = [int64][U]::GetWindowLongPtr($island, -20)
$flags = @{ TOOLWINDOW = 0x80; NOACTIVATE = 0x08000000; LAYERED = 0x80000; TOPMOST = 0x8; APPWINDOW = 0x40000 }
foreach ($f in 'TOOLWINDOW', 'NOACTIVATE', 'LAYERED', 'TOPMOST') {
  Check "Style WS_EX_$f" (($ex -band $flags[$f]) -ne 0)
}
Check 'Pas de WS_EX_APPWINDOW (absent de la barre des taches et d''Alt+Tab)' (($ex -band $flags.APPWINDOW) -eq 0)

# --- Geometry and region ----------------------------------------------------
$wr = New-Object U+RECT; [void][U]::GetWindowRect($island, [ref]$wr)
$rb = New-Object U+RECT; $kind = [U]::GetWindowRgnBox($island, [ref]$rb)
Check 'Fenetre collee en haut de l''ecran' ($wr.T -eq 0) "rect ($($wr.L),$($wr.T))-($($wr.R),$($wr.B))"
Check 'Region definie (limitee a la pilule)' ($kind -eq 2 -or $kind -eq 3) "boite de region ($($rb.L),$($rb.T))-($($rb.R),$($rb.B)) dans la fenetre"

$pill = New-Object U+POINT ([int](($wr.L + $rb.L + $wr.L + $rb.R) / 2)), ([int](($wr.T + $rb.T + $wr.T + $rb.B) / 2))
$outside = New-Object U+POINT ([int](($wr.L + $wr.R) / 2)), ([int]($wr.T + ($wr.B - $wr.T) * 0.6))

$hitPill = [U]::GetAncestor([U]::WindowFromPoint($pill), 2)
$hitOut = [U]::GetAncestor([U]::WindowFromPoint($outside), 2)
Check 'Le centre de la pilule appartient a l''ile' ($hitPill -eq $island)
Check 'Sous la pilule, la fenetre ne capte rien' ($hitOut -ne $island)

# --- Focus and click-through with a probe window ----------------------------
$log = Join-Path $env:TEMP "quiera-probe-$PID.txt"
Remove-Item $log -ErrorAction SilentlyContinue
$probeScript = @"
Add-Type -AssemblyName System.Windows.Forms
`$f = New-Object Windows.Forms.Form
`$f.Text = 'Quiera focus probe'
`$f.StartPosition = 'Manual'
`$b = [Windows.Forms.Screen]::PrimaryScreen.Bounds
`$f.Location = New-Object Drawing.Point(`$b.X, `$b.Y)
`$f.Size = New-Object Drawing.Size(`$b.Width, [int](`$b.Height * 0.6))
`$f.FormBorderStyle = 'None'
`$f.BackColor = 'DimGray'
`$t = New-Object Windows.Forms.TextBox
`$t.Location = New-Object Drawing.Point(20, [int](`$b.Height * 0.5))
`$f.Controls.Add(`$t)
`$f.Add_MouseDown({ Add-Content -Path '$log' -Value 'probe-click' })
`$f.Add_Shown({ `$f.Activate(); `$t.Focus() })
`$timer = New-Object Windows.Forms.Timer; `$timer.Interval = 15000; `$timer.Add_Tick({ `$f.Close() }); `$timer.Start()
[Windows.Forms.Application]::Run(`$f)
"@
$probe = Start-Process powershell -ArgumentList '-NoProfile', '-STA', '-Command', $probeScript -PassThru -WindowStyle Hidden
$probeHwnd = [IntPtr]::Zero
for ($i = 0; $i -lt 40 -and $probeHwnd -eq [IntPtr]::Zero; $i++) {
  Start-Sleep -Milliseconds 250
  $fg = [U]::GetForegroundWindow(); $sb = New-Object System.Text.StringBuilder 64
  [void][U]::GetWindowText($fg, $sb, 64)
  if ($sb.ToString() -eq 'Quiera focus probe') { $probeHwnd = $fg }
}
if ($probeHwnd -eq [IntPtr]::Zero) {
  Check 'Fenetre sonde au premier plan' $false 'la sonde n''a pas obtenu le focus ; tests de clic ignores'
} else {
  $saved = New-Object U+POINT; [void][U]::GetCursorPos([ref]$saved)
  function Click($p) {
    [void][U]::SetCursorPos($p.X, $p.Y); Start-Sleep -Milliseconds 120
    [U]::mouse_event(0x2, 0, 0, 0, [UIntPtr]::Zero); [U]::mouse_event(0x4, 0, 0, 0, [UIntPtr]::Zero)
    Start-Sleep -Milliseconds 400
  }
  Click $pill
  Check 'Clic sur la pilule : le focus reste a l''application active' ([U]::GetForegroundWindow() -eq $probeHwnd)
  $clicksBefore = @(Get-Content $log -ErrorAction SilentlyContinue).Count
  Click $outside
  $clicksAfter = @(Get-Content $log -ErrorAction SilentlyContinue).Count
  Check 'Clic a cote de la pilule : il atteint la fenetre du dessous' ($clicksAfter -gt $clicksBefore)
  [void][U]::SetCursorPos($saved.X, $saved.Y)
}
Stop-Process -Id $probe.Id -ErrorAction SilentlyContinue
Remove-Item $log -ErrorAction SilentlyContinue

# --- Memory and idle CPU ----------------------------------------------------
function Get-Tree([int]$rootId) {
  $all = Get-CimInstance Win32_Process
  $ids = @($rootId); $frontier = @($rootId)
  while ($frontier.Count) {
    $next = @($all | Where-Object { $frontier -contains $_.ParentProcessId } | ForEach-Object { [int]$_.ProcessId })
    $ids += $next; $frontier = $next
  }
  $ids
}
$ids = Get-Tree $proc.Id
$procs = @(Get-Process -Id $ids -ErrorAction SilentlyContinue)
$ws = ($procs | Measure-Object WorkingSet64 -Sum).Sum / 1MB
$priv = ($procs | Measure-Object PrivateMemorySize64 -Sum).Sum / 1MB
$cpu0 = ($procs | ForEach-Object { $_.TotalProcessorTime.TotalMilliseconds } | Measure-Object -Sum).Sum
Start-Sleep -Seconds $CpuSampleSeconds
$procs = @(Get-Process -Id $ids -ErrorAction SilentlyContinue)
$cpu1 = ($procs | ForEach-Object { $_.TotalProcessorTime.TotalMilliseconds } | Measure-Object -Sum).Sum
$cpuPct = ($cpu1 - $cpu0) / ($CpuSampleSeconds * 1000 * [Environment]::ProcessorCount) * 100

$results | Format-Table -AutoSize | Out-String -Width 200
'Processus (Quiera + WebView2) : {0}' -f $procs.Count
'Memoire, working set total     : {0:N0} Mo' -f $ws
'Memoire privee totale          : {0:N0} Mo' -f $priv
'CPU au repos sur {0} s          : {1:N2} % de la machine ({2:N0} ms de CPU)' -f $CpuSampleSeconds, $cpuPct, ($cpu1 - $cpu0)
if ($results.Result -contains 'ECHEC') { exit 1 }
