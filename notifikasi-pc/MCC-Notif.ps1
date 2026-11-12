# =====================================================================
#  MCC Spare Part System - notifikasi Windows (jalan di background)
#  Notifikasi request baru, reject teknisi dan stok minimum tetap muncul
#  walaupun browser / aplikasi MCC ditutup. Ikon ada di pojok kanan bawah
#  (system tray). Klik kanan ikon -> Buka MCC Admin / Keluar.
#
#  Pasang (sekali):   klik dua kali PASANG-NOTIF.bat
#  Copot:             klik dua kali COPOT-NOTIF.bat
# =====================================================================
param(
  [string]$Server = 'http://192.168.100.1:3000',
  [int]$Detik = 30,
  [switch]$Pasang,
  [switch]$Copot
)

$ErrorActionPreference = 'Stop'
$Folder   = Join-Path $env:LOCALAPPDATA 'MCC-Notif'
$Shortcut = Join-Path ([Environment]::GetFolderPath('Startup')) 'MCC Notifikasi.lnk'

if ($Pasang) {
  New-Item -ItemType Directory -Force -Path $Folder | Out-Null
  $tujuan = Join-Path $Folder 'MCC-Notif.ps1'
  if ((Resolve-Path $PSCommandPath).Path -ne $tujuan) { Copy-Item -Force -Path $PSCommandPath -Destination $tujuan }
  # Hentikan versi lama yang sedang jalan supaya versi baru yang dipakai
  Get-CimInstance Win32_Process -Filter "Name = 'powershell.exe'" |
    Where-Object { $_.CommandLine -like '*MCC-Notif.ps1*' -and $_.CommandLine -notlike '*-Pasang*' -and $_.ProcessId -ne $PID } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
  $ws = New-Object -ComObject WScript.Shell
  $s = $ws.CreateShortcut($Shortcut)
  $s.TargetPath = 'powershell.exe'
  $s.Arguments  = '-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File "' + (Join-Path $Folder 'MCC-Notif.ps1') + '" -Server ' + $Server
  $s.WindowStyle = 7
  $s.Description = 'MCC Spare Part - notifikasi'
  $s.Save()
  Start-Process -FilePath 'powershell.exe' -ArgumentList $s.Arguments -WindowStyle Hidden
  Write-Host ''
  Write-Host 'Notifikasi MCC terpasang.' -ForegroundColor Green
  Write-Host ('Server : ' + $Server)
  Write-Host 'Program berjalan sekarang dan otomatis jalan setiap Windows dinyalakan.'
  Write-Host 'Cari ikon (i) di pojok kanan bawah layar (klik panah ^ kalau tidak terlihat).'
  exit 0
}

if ($Copot) {
  if (Test-Path $Shortcut) { Remove-Item -Force $Shortcut }
  Get-CimInstance Win32_Process -Filter "Name = 'powershell.exe'" |
    Where-Object { $_.CommandLine -like '*MCC-Notif.ps1*' -and $_.ProcessId -ne $PID } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
  Write-Host 'Notifikasi MCC dicopot (tidak jalan lagi saat Windows dinyalakan).' -ForegroundColor Yellow
  exit 0
}

# ---- Program notifikasi ----
$ErrorActionPreference = 'Continue'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

# Hanya satu program yang jalan
$mutexBaru = $false
$mutex = New-Object System.Threading.Mutex($true, 'MCC-Notif-SatuSaja', [ref]$mutexBaru)
if (-not $mutexBaru) { exit 0 }

New-Item -ItemType Directory -Force -Path $Folder | Out-Null
$FileStatus = Join-Path $Folder 'status.json'

$icon = New-Object System.Windows.Forms.NotifyIcon
$icon.Icon = [System.Drawing.SystemIcons]::Information
$icon.Text = 'MCC: menghubungkan...'
$icon.Visible = $true

$menu = New-Object System.Windows.Forms.ContextMenuStrip
[void]$menu.Items.Add('Buka MCC Admin', $null, { Start-Process ($Server + '/') })
[void]$menu.Items.Add('Cek sekarang', $null, { & $script:Cek })
[void]$menu.Items.Add('Keluar', $null, { $icon.Visible = $false; [System.Windows.Forms.Application]::Exit() })
$icon.ContextMenuStrip = $menu
$icon.add_BalloonTipClicked({ Start-Process ($Server + '/') })
$icon.add_DoubleClick({ Start-Process ($Server + '/') })

# Status: id yang sudah pernah diberi tahu (disimpan supaya tidak muncul ulang setelah restart)
$script:Tahu = @{ pending = @(); reject = @(); low = @(); awal = $true }
if (Test-Path $FileStatus) {
  try {
    $j = Get-Content -Raw -Path $FileStatus | ConvertFrom-Json
    $script:Tahu.pending = @($j.pending | ForEach-Object { [int]$_ })
    $script:Tahu.reject  = @($j.reject  | ForEach-Object { [int]$_ })
    $script:Tahu.low     = @($j.low     | ForEach-Object { [int]$_ })
    $script:Tahu.awal    = $false
  } catch { }
}

function Potong([string]$t, [int]$n) { if ($t.Length -gt $n) { return $t.Substring(0, $n - 3) + '...' } return $t }

$script:Cek = {
  try {
    $d = Invoke-RestMethod -Uri ($Server + '/api/notif') -TimeoutSec 15 -UseBasicParsing
    if (-not $d.success) { $icon.Text = 'MCC: server error'; return }
    $idP = @($d.pending | ForEach-Object { [int]$_.id })
    $idR = @($d.reject  | ForEach-Object { [int]$_.id })
    $idL = @($d.low     | ForEach-Object { [int]$_.id })
    $baris = @(); $judul = @(); $penting = $false
    if (-not $script:Tahu.awal) {
      $bP = @($d.pending | Where-Object { $script:Tahu.pending -notcontains [int]$_.id })
      $bR = @($d.reject  | Where-Object { $script:Tahu.reject  -notcontains [int]$_.id })
      $bL = @($d.low     | Where-Object { $script:Tahu.low     -notcontains [int]$_.id })
      if ($bP.Count) {
        $judul += ('' + $bP.Count + ' request baru')
        $bP | Select-Object -First 3 | ForEach-Object { $u = ''; if ($_.urgent) { $u = ' [URGENT]'; $penting = $true }; $baris += ('Request: ' + $_.teknisi_nama + ' - ' + $_.part_nama + ' x' + $_.jumlah + $u) }
      }
      if ($bR.Count) {
        $judul += ('' + $bR.Count + ' ditolak teknisi'); $penting = $true
        $bR | Select-Object -First 2 | ForEach-Object { $baris += ('Ditolak: ' + $_.teknisi_nama + ' - ' + $_.part_nama + ' x' + $_.jumlah) }
      }
      if ($bL.Count) {
        $judul += ('' + $bL.Count + ' stok minimum')
        $bL | Select-Object -First 3 | ForEach-Object { $baris += ('Stok min: ' + $_.nama_part + ' ' + $_.stok + '/' + $_.min_stok) }
      }
    }
    if ($baris.Count) {
      $icon.BalloonTipTitle = Potong ('MCC: ' + ($judul -join ', ')) 63
      $icon.BalloonTipText  = Potong ($baris -join "`n") 250
      if ($penting) { $icon.BalloonTipIcon = 'Warning' } else { $icon.BalloonTipIcon = 'Info' }
      $icon.ShowBalloonTip(20000)
      [System.Media.SystemSounds]::Exclamation.Play()
    }
    # Request & stok: ikuti kondisi sekarang (kalau stok naik lalu turun lagi, diberi tahu lagi)
    $script:Tahu.pending = $idP
    $script:Tahu.low     = $idL
    # Reject: simpan yang pernah dilihat (maks 500)
    $script:Tahu.reject  = @(@($idR) + @($script:Tahu.reject) | Select-Object -Unique | Select-Object -First 500)
    $script:Tahu.awal    = $false
    @{ pending = $script:Tahu.pending; reject = $script:Tahu.reject; low = $script:Tahu.low } | ConvertTo-Json | Set-Content -Path $FileStatus -Encoding UTF8
    $icon.Text = Potong ('MCC: ' + $idP.Count + ' request menunggu, ' + $idL.Count + ' stok min') 63
  } catch {
    $icon.Text = 'MCC: server tidak terhubung'
  }
}

$timer = New-Object System.Windows.Forms.Timer
$timer.Interval = [Math]::Max(10, $Detik) * 1000
$timer.add_Tick({ & $script:Cek })
$timer.Start()
& $script:Cek
[System.Windows.Forms.Application]::Run()
$icon.Dispose()
