# ==============================================================================
# Chaos Controller CLI Script
# Usage:
#   .\chaos.ps1 status
#   .\chaos.ps1 choke-redis [latencyMs]   (default: 500ms)
#   .\chaos.ps1 heal-redis
#   .\chaos.ps1 cut-redis
#   .\chaos.ps1 restore-redis
#   .\chaos.ps1 choke-db [latencyMs]      (default: 1000ms)
#   .\chaos.ps1 heal-db
#   .\chaos.ps1 reset
# ==============================================================================

param (
    [Parameter(Position = 0, Mandatory = $true)]
    [ValidateSet("status", "choke-redis", "heal-redis", "cut-redis", "restore-redis", "choke-db", "heal-db", "reset")]
    [string]$Action,

    [Parameter(Position = 1)]
    [int]$Latency = 500
)

$toxiproxyUrl = "http://localhost:8474"

switch ($Action) {
    "status" {
        Write-Host "=== TOXIPROXY ACTIVE STATUS ===" -ForegroundColor Cyan
        try {
            $proxies = Invoke-RestMethod -UserAgent "toxiproxy-cli" -Uri "$toxiproxyUrl/proxies" -Method Get
            foreach ($p in $proxies.PSObject.Properties) {
                $name = $p.Name
                $item = $p.Value
                $enabled = $item.enabled
                $statusColor = if ($enabled) { "Green" } else { "Red" }
                Write-Host "Proxy: $name (Listen: $($item.listen) -> $($item.upstream)) | Enabled: $enabled" -ForegroundColor $statusColor
                
                if ($item.toxics.Count -gt 0) {
                    Write-Host "  Active Toxics:" -ForegroundColor Yellow
                    foreach ($t in $item.toxics) {
                        Write-Host "    - $($t.name): type=$($t.type), latency=$($t.attributes.latency)ms, jitter=$($t.attributes.jitter)ms" -ForegroundColor Red
                    }
                } else {
                    Write-Host "  No active toxics (Clean Network)" -ForegroundColor DarkGray
                }
            }
        } catch {
            Write-Host "Error connecting to Toxiproxy at $toxiproxyUrl. Is the container running?" -ForegroundColor Red
        }
    }

    "choke-redis" {
        Write-Host "💥 Injecting $Latency ms latency into Redis (orders-redis:26379)..." -ForegroundColor Yellow
        $toxic = @{
            name = "redis_latency"
            type = "latency"
            stream = "downstream"
            toxicity = 1.0
            attributes = @{
                latency = $Latency
                jitter = [math]::Round($Latency * 0.1)
            }
        } | ConvertTo-Json

        try {
            Invoke-RestMethod -UserAgent "toxiproxy-cli" -Uri "$toxiproxyUrl/proxies/orders-redis/toxics" -Method Post -Body $toxic -ContentType "application/json" | Out-Null
            Write-Host "  [ATTACK ACTIVE] Redis response delayed by $Latency ms (+- 10% jitter)!" -ForegroundColor Red
            Write-Host "  Watch Grafana: p99 latency will spike and Tomcat worker threads will saturate." -ForegroundColor Yellow
        } catch {
            Write-Host "  Failed to inject toxic. Check if proxy exists (run .\init-toxiproxy.ps1 first)." -ForegroundColor Red
        }
    }

    "heal-redis" {
        Write-Host "🛡️ Removing latency toxic from Redis (orders-redis)..." -ForegroundColor Cyan
        try {
            Invoke-RestMethod -UserAgent "toxiproxy-cli" -Uri "$toxiproxyUrl/proxies/orders-redis/toxics/redis_latency" -Method Delete | Out-Null
            Write-Host "  [HEALED] Redis network restored to 0ms latency!" -ForegroundColor Green
            Write-Host "  Watch Grafana: p99 latency will plunge back down to < 25ms." -ForegroundColor Green
        } catch {
            Write-Host "  No active latency toxic found on orders-redis." -ForegroundColor Yellow
        }
    }

    "cut-redis" {
        Write-Host "☠️ Severing TCP connection to Redis (Connection Refused)..." -ForegroundColor Red
        $disable = @{ enabled = $false } | ConvertTo-Json
        try {
            Invoke-RestMethod -UserAgent "toxiproxy-cli" -Uri "$toxiproxyUrl/proxies/orders-redis" -Method Post -Body $disable -ContentType "application/json" | Out-Null
            Write-Host "  [SEVERED] orders-redis port 26379 closed!" -ForegroundColor Red
        } catch {
            Write-Host "  Failed to disable proxy." -ForegroundColor Red
        }
    }

    "restore-redis" {
        Write-Host "🛡️ Restoring TCP connection to Redis..." -ForegroundColor Green
        $enable = @{ enabled = $true } | ConvertTo-Json
        try {
            Invoke-RestMethod -UserAgent "toxiproxy-cli" -Uri "$toxiproxyUrl/proxies/orders-redis" -Method Post -Body $enable -ContentType "application/json" | Out-Null
            Write-Host "  [RESTORED] orders-redis port 26379 re-opened!" -ForegroundColor Green
        } catch {
            Write-Host "  Failed to enable proxy." -ForegroundColor Red
        }
    }

    "choke-db" {
        Write-Host "💥 Injecting $Latency ms latency into PostgreSQL (orders-postgres:25432)..." -ForegroundColor Yellow
        $toxic = @{
            name = "db_latency"
            type = "latency"
            stream = "downstream"
            toxicity = 1.0
            attributes = @{
                latency = $Latency
                jitter = 100
            }
        } | ConvertTo-Json

        try {
            Invoke-RestMethod -UserAgent "toxiproxy-cli" -Uri "$toxiproxyUrl/proxies/orders-postgres/toxics" -Method Post -Body $toxic -ContentType "application/json" | Out-Null
            Write-Host "  [ATTACK ACTIVE] PostgreSQL transactions delayed by $Latency ms!" -ForegroundColor Red
            Write-Host "  Watch Grafana: HikariCP active connection pool will reach 10/10." -ForegroundColor Yellow
        } catch {
            Write-Host "  Failed to inject toxic." -ForegroundColor Red
        }
    }

    "heal-db" {
        Write-Host "🛡️ Removing latency toxic from PostgreSQL..." -ForegroundColor Cyan
        try {
            Invoke-RestMethod -UserAgent "toxiproxy-cli" -Uri "$toxiproxyUrl/proxies/orders-postgres/toxics/db_latency" -Method Delete | Out-Null
            Write-Host "  [HEALED] PostgreSQL connection restored to 0ms latency!" -ForegroundColor Green
        } catch {
            Write-Host "  No active latency toxic found on orders-postgres." -ForegroundColor Yellow
        }
    }

    "reset" {
        Write-Host "🔄 Resetting all toxics across all proxies..." -ForegroundColor Cyan
        try {
            $proxies = Invoke-RestMethod -UserAgent "toxiproxy-cli" -Uri "$toxiproxyUrl/proxies" -Method Get
            foreach ($p in $proxies.PSObject.Properties) {
                $name = $p.Name
                # Re-enable
                $enable = @{ enabled = $true } | ConvertTo-Json
                Invoke-RestMethod -UserAgent "toxiproxy-cli" -Uri "$toxiproxyUrl/proxies/$name" -Method Post -Body $enable -ContentType "application/json" | Out-Null
                
                # Delete all toxics
                $toxics = Invoke-RestMethod -UserAgent "toxiproxy-cli" -Uri "$toxiproxyUrl/proxies/$name/toxics" -Method Get
                foreach ($t in $toxics) {
                    Invoke-RestMethod -UserAgent "toxiproxy-cli" -Uri "$toxiproxyUrl/proxies/$name/toxics/$($t.name)" -Method Delete | Out-Null
                }
            }
            Write-Host "  [CLEAN SLATE] All toxics cleared and proxies enabled." -ForegroundColor Green
        } catch {
            Write-Host "  Failed to reset toxics." -ForegroundColor Red
        }
    }
}

