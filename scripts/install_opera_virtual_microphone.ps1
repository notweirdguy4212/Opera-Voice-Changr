[CmdletBinding()]
param(
  [Parameter(Mandatory = $true, HelpMessage = 'Path to the official virtual audio cable installer you downloaded from its publisher.')]
  [ValidateScript({ Test-Path -LiteralPath $_ -PathType Leaf })]
  [string]$InstallerPath
)
$ErrorActionPreference = 'Stop'
$resolved = (Resolve-Path -LiteralPath $InstallerPath).Path
$signature = Get-AuthenticodeSignature -FilePath $resolved
if ($signature.Status -ne 'Valid') {
  throw "Installer signature is not valid ($($signature.Status)). Do not run an unsigned or altered driver package."
}
$publisher = $signature.SignerCertificate.Subject
if ($publisher -notmatch 'VB-Audio|VB-Audio Software') {
  throw "Unexpected publisher: $publisher. This helper only accepts a signed VB-Audio installer."
}
Write-Host 'Verified signed VB-Audio installer.' -ForegroundColor Green
Write-Host 'This installs a third-party system audio driver and may require a restart.'
$confirm = Read-Host 'Type INSTALL to continue'
if ($confirm -cne 'INSTALL') { Write-Host 'Cancelled.'; exit 0 }
$process = Start-Process -FilePath $resolved -Verb RunAs -Wait -PassThru
if ($process.ExitCode -ne 0) { throw "Installer exited with code $($process.ExitCode)." }
Write-Host 'Installer completed. Restart Windows if the driver requests it, then select the virtual cable in Opera and your target app.' -ForegroundColor Green
