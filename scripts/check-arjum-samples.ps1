$ErrorActionPreference='Stop'
$samples=@(Get-Content (Join-Path $PSScriptRoot '../docs/arjum-samples.json') -Raw | ConvertFrom-Json)+@(Get-Content (Join-Path $PSScriptRoot '../docs/arjum-extra-samples.json') -Raw | ConvertFrom-Json)
$index=@(($samples | Where-Object path -eq '/api/history/IHSG?limit=500').body.rows.date)
$report=foreach($s in $samples | Where-Object { $_.path -like '/api/history/*' -and $_.status -eq 200 }) {
 $rows=@($s.body.rows | Sort-Object date)
 $invalid=0; $returns=0; $foreign=0; $weekends=0; $nulls=0; $large=@()
 for($i=0;$i -lt $rows.Count;$i++) {
  $r=$rows[$i]
  foreach($f in @('date','open','high','low','close','volume')) { if($null -eq $r.$f){$nulls++} }
  if($r.low -gt $r.high -or $r.open -lt $r.low -or $r.open -gt $r.high -or $r.close -lt $r.low -or $r.close -gt $r.high -or $r.low -le 0 -or $r.volume -lt 0){$invalid++}
  if(([datetime]$r.date).DayOfWeek -in @('Saturday','Sunday')){$weekends++}
  if($null -ne $r.f_buy -and $null -ne $r.f_sell -and $null -ne $r.n_foreign -and [math]::Abs(($r.f_buy-$r.f_sell)-$r.n_foreign) -gt 1){$foreign++}
  if($i -gt 0 -and $rows[$i-1].close -gt 0){
   $pct=100*($r.close/$rows[$i-1].close-1)
   if($null -ne $r.change_pct -and [math]::Abs($pct-$r.change_pct) -gt 0.025){$returns++}
   if([math]::Abs($pct) -gt 20){$large += $r.date}
  }
 }
 [pscustomobject]@{path=$s.path;rows=$rows.Count;start=$rows[0].date;end=$rows[-1].date;missingRequiredValues=$nulls;invalidOHLCV=$invalid;duplicateDates=@($rows|Group-Object date|Where-Object Count -gt 1).Count;weekendDates=$weekends;returnMismatches=$returns;foreignArithmeticMismatches=$foreign;movesOver20Percent=$large;missingComparedWithIHSG=$(if($s.path -notmatch 'start_date'){@($index|Where-Object {$_ -notin $rows.date}).Count}else{$null})}
}
$report | ConvertTo-Json -Depth 10 | Set-Content (Join-Path $PSScriptRoot '../docs/arjum-quality-results.json')
$report | ConvertTo-Json -Depth 10
