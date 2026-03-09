$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ServerName = Split-Path -Leaf $ScriptDir
& (Join-Path $ScriptDir "..\..\install-server.ps1") $ServerName @args
