$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
& "$ScriptDir\..\..\install-server.ps1" (Split-Path -Leaf $ScriptDir)
