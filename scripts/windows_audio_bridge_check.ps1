# Read-only helper: inspect Windows audio endpoints before configuring a virtual cable.
# Does not install drivers, change defaults, or capture microphone audio.
$ErrorActionPreference = 'Stop'
Write-Host 'Opera Voice Changer 2.0 — audio bridge checklist' -ForegroundColor Cyan
Write-Host 'This check is informational only; it does not install or configure audio drivers.'
try {
  Get-CimInstance Win32_SoundDevice |
    Select-Object Name, Manufacturer, Status |
    Format-Table -AutoSize
} catch {
  Write-Warning "Could not enumerate sound devices: $($_.Exception.Message)"
}
Write-Host ''
Write-Host 'Next:'
Write-Host '  1. Install/enable a virtual audio cable from its official publisher.'
Write-Host '  2. Set Opera playback to the cable playback endpoint.'
Write-Host '  3. Set the target app microphone to the cable recording endpoint.'
Write-Host '  4. Use headphones and verify the target app mic test.'
