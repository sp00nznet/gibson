# GIBSON shell integration for PowerShell. main.js passes this after your profile has run (as
# -EncodedCommand, so no execution policy gets in the way). It wraps your prompt to mark where
# each prompt starts and ends (OSC 133 A/B), the exit code of the last command (133 D) and the
# folder (OSC 9;9), and marks where a command's output starts (133 C) from the Enter key.
if (-not $global:__gibson) {
  $global:__gibson = $true
  $global:__gibsonPrompt = $function:prompt
  function global:prompt {
    $ok = $global:?; $code = $global:LASTEXITCODE
    $e = [char]27; $b = [char]7
    $c = if ($ok) { 0 } elseif ($code) { $code } else { 1 }
    $out = "$e]133;D;$c$b"
    $loc = $executionContext.SessionState.Path.CurrentLocation
    if ($loc.Provider.Name -eq 'FileSystem') { $out += "$e]9;9;`"$($loc.ProviderPath)`"$b" }
    $p = & $global:__gibsonPrompt
    $global:LASTEXITCODE = $code
    "$out$e]133;A$b$p$e]133;B$b"
  }
  if (Get-Module PSReadLine) {
    $h = try { Get-PSReadLineKeyHandler -Bound | Where-Object { $_.Key -eq 'Enter' } | Select-Object -First 1 } catch { $null } # -Chord is newer than 5.1's PSReadLine
    if (-not $h -or $h.Function -eq 'AcceptLine') { # leave a custom Enter alone
      Set-PSReadLineKeyHandler -Chord Enter -ScriptBlock {
        [Microsoft.PowerShell.PSConsoleReadLine]::AcceptLine()
        [Console]::Write("$([char]27)]133;C$([char]7)")
      }
    }
  }
}
