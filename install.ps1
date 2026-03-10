# OpenClaw MCP Client Plugin - Windows Installer
# Usage: irm https://raw.githubusercontent.com/AIWerk/openclaw-mcp-bridge/master/install.ps1 | iex
$ErrorActionPreference = "Stop"

$PluginDir = "$env:USERPROFILE\.openclaw\extensions\openclaw-mcp-bridge"
$ConfigFile = "$env:USERPROFILE\.openclaw\openclaw.json"

Write-Host "📦 Installing OpenClaw MCP Client Plugin..." -ForegroundColor Cyan

# 1. Clone or update
if (Test-Path "$PluginDir\.git") {
    Write-Host "⬆️  Updating existing installation..."
    Push-Location $PluginDir
    git pull --ff-only
    Pop-Location
} else {
    Write-Host "📥 Cloning plugin..."
    $parent = Split-Path $PluginDir -Parent
    if (-not (Test-Path $parent)) { New-Item -ItemType Directory -Path $parent -Force | Out-Null }
    git clone https://github.com/AIWerk/openclaw-mcp-bridge.git $PluginDir
}

# 2. Install dependencies (TypeBox is required for JSON Schema conversion)
Write-Host "📦 Installing dependencies..."
Push-Location $PluginDir
npm install --production 2>&1 | Select-Object -Last 1
Pop-Location
Write-Host ""

# 3. Choose mode
Write-Host ""
Write-Host "🔧 Choose plugin mode:" -ForegroundColor Cyan
Write-Host ""
Write-Host "  [1] Router (recommended)"
Write-Host "      Single 'mcp' tool, ~300 tokens. Agent discovers tools on-demand."
Write-Host "      Best for 3+ servers. Saves ~98% context tokens."
Write-Host ""
Write-Host "  [2] Direct"
Write-Host "      All tools registered individually as native tools."
Write-Host "      Simple, but ~80 tokens per tool (can add up with many servers)."
Write-Host ""
$ModeChoice = Read-Host "Mode [1/2, default=1]"
if ($ModeChoice -eq "2") { $PluginMode = "direct" } else { $PluginMode = "router" }
Write-Host "  → Using $PluginMode mode" -ForegroundColor Green
Write-Host ""

# 4. Add to openclaw.json if not already present
if (Test-Path $ConfigFile) {
    $cfg = Get-Content $ConfigFile -Raw | ConvertFrom-Json

    if (-not $cfg.plugins) { $cfg | Add-Member -NotePropertyName plugins -NotePropertyValue ([PSCustomObject]@{}) }
    if (-not $cfg.plugins.allow) { $cfg.plugins | Add-Member -NotePropertyName allow -NotePropertyValue @() }
    if (-not $cfg.plugins.entries) { $cfg.plugins | Add-Member -NotePropertyName entries -NotePropertyValue ([PSCustomObject]@{}) }

    if ($cfg.plugins.allow -notcontains "openclaw-mcp-bridge") {
        $cfg.plugins.allow = @($cfg.plugins.allow) + "openclaw-mcp-bridge"
    }

    if (-not $cfg.plugins.entries."openclaw-mcp-bridge") {
        $cfg.plugins.entries | Add-Member -NotePropertyName "openclaw-mcp-bridge" -NotePropertyValue ([PSCustomObject]@{
            enabled = $true
            config = [PSCustomObject]@{
                mode = $PluginMode
                servers = [PSCustomObject]@{}
                toolPrefix = $true
                reconnectIntervalMs = 30000
                connectionTimeoutMs = 10000
                requestTimeoutMs = 60000
            }
        })
        Write-Host "✅ Plugin added to config (mode: $PluginMode)" -ForegroundColor Green
    } else {
        $existingConfig = $cfg.plugins.entries."openclaw-mcp-bridge".config
        if ($existingConfig.mode -ne $PluginMode) {
            $existingConfig | Add-Member -NotePropertyName mode -NotePropertyValue $PluginMode -Force
            Write-Host "✅ Plugin mode updated to $PluginMode" -ForegroundColor Green
        } else {
            Write-Host "ℹ️  Plugin already in config (mode: $PluginMode)" -ForegroundColor Yellow
        }
    }

    $cfg | ConvertTo-Json -Depth 10 | Set-Content $ConfigFile -Encoding UTF8
} else {
    Write-Host "⚠️  Config not found at $ConfigFile" -ForegroundColor Yellow
}

# Register add-mcp-server skill via junction
$SkillSource = "$PluginDir\skills\add-mcp-server"
if (Test-Path $SkillSource) {
    $SkillsDir = $null

    # 1. Try reading workspace from openclaw.json
    if (Test-Path $ConfigFile) {
        try {
            $cfgRead = Get-Content $ConfigFile -Raw | ConvertFrom-Json
            $ws = if ($cfgRead.workspace) { $cfgRead.workspace }
                 elseif ($cfgRead.agent -and $cfgRead.agent.workspace) { $cfgRead.agent.workspace }
                 elseif ($cfgRead.agents -and $cfgRead.agents.defaults -and $cfgRead.agents.defaults.workspace) { $cfgRead.agents.defaults.workspace }
                 else { $null }
            if ($ws -and (Test-Path $ws)) { $SkillsDir = "$ws\skills" }
        } catch {}
    }

    # 2. Fallback: try common locations
    if (-not $SkillsDir) {
        foreach ($candidate in @("$env:USERPROFILE\clawd\skills", "$env:USERPROFILE\.openclaw\skills", "$env:USERPROFILE\openclaw\skills")) {
            if (Test-Path $candidate) { $SkillsDir = $candidate; break }
        }
    }

    # 3. Last resort: use ~/.openclaw/skills
    if (-not $SkillsDir) { $SkillsDir = "$env:USERPROFILE\.openclaw\skills" }

    # Create skills dir if needed and junction
    if (-not (Test-Path $SkillsDir)) { New-Item -ItemType Directory -Path $SkillsDir -Force | Out-Null }
    $SkillLink = "$SkillsDir\add-mcp-server"
    if (-not (Test-Path $SkillLink)) {
        try {
            New-Item -ItemType Junction -Path $SkillLink -Target $SkillSource -ErrorAction Stop | Out-Null
            Write-Host "🧠 Skill 'add-mcp-server' registered in $SkillsDir\" -ForegroundColor Green
        } catch {
            Write-Host "⚠️  Could not register skill automatically. Create a junction manually:" -ForegroundColor Yellow
            Write-Host "     cmd /c mklink /J `"$SkillLink`" `"$SkillSource`"" -ForegroundColor Yellow
        }
    } else {
        Write-Host "🧠 Skill 'add-mcp-server' already registered in $SkillsDir\" -ForegroundColor Green
    }
}

Write-Host ""
Write-Host "✅ MCP Client Plugin installed!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:"
Write-Host "  1. Install an MCP server:"
Write-Host "     cd $env:USERPROFILE\.openclaw\extensions\openclaw-mcp-bridge"
Write-Host "     .\install-server.ps1 <SERVER_NAME>"
Write-Host ""
Write-Host "  2. Or ask your agent: 'Add the X MCP server'"
Write-Host "     (uses the add-mcp-server skill)"
Write-Host ""
Write-Host "  Available servers: dir $env:USERPROFILE\.openclaw\extensions\openclaw-mcp-bridge\servers\"
Write-Host ""
