$serverDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$serverName = Split-Path -Leaf $serverDir
$root = Split-Path -Parent (Split-Path -Parent $serverDir)
& "$root\install-server.ps1" $serverName @args
