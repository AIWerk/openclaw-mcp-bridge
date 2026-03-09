$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
& "$ScriptDir\..\..\install.ps1" (Split-Path -Leaf $ScriptDir)
