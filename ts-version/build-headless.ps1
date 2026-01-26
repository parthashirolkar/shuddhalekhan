param(
  [string]$ExePath = "speech-to-text.exe"
)

# Try to find editbin.exe in Visual Studio Build Tools
$editbinPaths = @(
  "C:\Program Files\Microsoft Visual Studio\2022\BuildTools\VC\Tools\MSVC\*\bin\Hostx64\x64\editbin.exe",
  "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Tools\MSVC\*\bin\Hostx64\x64\editbin.exe",
  "C:\Program Files\Microsoft Visual Studio\2022\Community\VC\Tools\MSVC\*\bin\Hostx64\x64\editbin.exe",
  "C:\Program Files\Microsoft Visual Studio\2022\Professional\VC\Tools\MSVC\*\bin\Hostx64\x64\editbin.exe",
  "C:\Program Files\Microsoft Visual Studio\2022\Enterprise\VC\Tools\MSVC\*\bin\Hostx64\x64\editbin.exe",
  "C:\Program Files\Microsoft Visual Studio\2019\BuildTools\VC\Tools\MSVC\*\bin\Hostx64\x64\editbin.exe",
  "C:\Program Files\Microsoft Visual Studio\2019\Community\VC\Tools\MSVC\*\bin\Hostx64\x64\editbin.exe",
  "C:\Program Files\Microsoft Visual Studio\2019\Professional\VC\Tools\MSVC\*\bin\Hostx64\x64\editbin.exe",
  "C:\Program Files\Microsoft Visual Studio\2019\Enterprise\VC\Tools\MSVC\*\bin\Hostx64\x64\editbin.exe"
)

$editbin = $null
foreach ($path in $editbinPaths) {
  $resolved = Resolve-Path -Path $path -ErrorAction SilentlyContinue
  if ($resolved) {
    $editbin = $resolved.Path
    break
  }
}

if ($editbin -and (Test-Path $editbin)) {
  try {
    & $editbin /SUBSYSTEM:WINDOWS $ExePath 2>&1 | Out-Null
    Write-Host "Build complete - GUI subsystem set"
  } catch {
    Write-Host "editbin failed: $($_.Exception.Message)"
  }
} else {
  Write-Host "editbin.exe not found - skipping subsystem change"
  Write-Host "Install Visual Studio Build Tools to enable GUI subsystem mode"
}
