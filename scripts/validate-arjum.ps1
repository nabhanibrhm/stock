$ErrorActionPreference = 'Stop'
$keyLine = Get-Content -LiteralPath (Join-Path $PSScriptRoot '../.env') | Where-Object { $_ -match '^ARJUM_API_KEY=' } | Select-Object -First 1
$apiKey = ($keyLine -replace '^ARJUM_API_KEY=', '').Trim().Trim('"').Trim("'")
if (!$apiKey) { throw 'Missing API key' }
$results = @()
$paths = @('/api/history/BBCA?limit=500','/api/history/BBRI?limit=500','/api/history/TLKM?limit=500','/api/history/ANTM?limit=500','/api/search?q=IHSG','/api/search?q=JKSE','/api/history/BBCA?limit=500&start_date=2021-10-01&end_date=2021-10-20','/api/screener/latest','/api/history/IHSG?limit=500')
foreach ($path in $paths) {
 try {
  $r = Invoke-WebRequest -Uri ('https://stock.arjum.com' + $path) -Headers @{'X-API-Key'=$apiKey;Accept='application/json'} -MaximumRedirection 0 -TimeoutSec 40 -SkipHttpErrorCheck
  $body = $r.Content.Replace($apiKey,'[REDACTED]') | ConvertFrom-Json
  $results += [pscustomobject]@{path=$path;status=[int]$r.StatusCode;quotaCost=($r.Headers['x-quota-cost'] -join ',');remaining=($r.Headers['x-ratelimit-remaining'] -join ',');body=$body}
  Write-Output ($path + ' HTTP ' + [int]$r.StatusCode)
 } catch { $results += [pscustomobject]@{path=$path;error=$_.Exception.GetType().Name}; Write-Output ($path + ' failed') }
}
$results | ConvertTo-Json -Depth 50 | Set-Content (Join-Path $PSScriptRoot '../docs/arjum-samples.json')

$results | Where-Object { $_.path -eq '/api/history/IHSG?limit=500' } | ConvertTo-Json -Depth 50 -AsArray | Set-Content (Join-Path $PSScriptRoot '../docs/arjum-extra-samples.json')

