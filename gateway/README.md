# Gateway PLC Modbus TCP

Gateway ini berjalan di komputer yang dapat dijangkau PLC. Vercel menyediakan editor online; Vercel tidak menjalankan listener Modbus TCP ke jaringan lokal Anda.

## Mulai (Node.js 22 atau lebih baru)

Unduh repository dan buka terminal di foldernya:

```sh
npm ci
npm run build
npm run gateway
```

Buka `http://127.0.0.1:8765`, klik **PLC**, masukkan token yang ditampilkan terminal, lalu **Hubungkan**. Token disimpan hanya dalam memori halaman, tidak di file proyek. Jika scene dibuat di Vercel, ekspor JSON dari sana lalu impor di workspace lokal.

## PLC fisik

Gateway default menerima Modbus hanya dari localhost. Untuk PLC di LAN, pilih alamat adapter Ethernet komputer Anda secara eksplisit. Contoh PowerShell (ganti IP dengan IP komputer gateway Anda):

```powershell
$env:MODBUS_HOST="192.168.1.10"
$env:MODBUS_PORT="1502"
npm run gateway
```

Di PLC, gunakan Modbus TCP **client/master** ke IP tersebut, port 1502, Unit ID 1. Izinkan port hanya dari IP PLC pada firewall komputer. PLC dengan fungsi server saja belum didukung oleh driver ini. Protokol Siemens S7 dan OPC UA belum diimplementasikan.

| Area | Fungsi Modbus | Arah | Rentang alamat PDU |
|---|---|---|---|
| Discrete inputs | FC02 | Sensor scene → PLC | 0–255 |
| Coils | FC01 read, FC05/15 write | Perintah PLC → aktuator scene | 0–255 |
| Input register 0 | FC04 | Status RUN + heartbeat scene → PLC | 0 (0/1) |

Semua alamat pada aplikasi adalah **0-based**. Aplikasi PLC yang menampilkan alamat referensi dapat menyebut discrete input pertama sebagai 10001 dan coil pertama sebagai 00001; periksa konvensi perangkat lunak PLC Anda. Ini tidak mengubah alamat PDU 0.

PLC perlu memperbarui coil setidaknya sekali per detik. Setelah 1,5 detik tanpa penulisan coil, perintah aktuator dinolkan. Setelah heartbeat browser terputus, input dan coil dinolkan. Mode STOP/PAUSE juga mengosongkan I/O virtual. Ini mekanisme simulasi, bukan pengganti rangkaian emergency stop atau keselamatan mesin.

## Editor online dan WSS

Halaman HTTPS Vercel tidak menggunakan WebSocket HTTP biasa. Jalur paling sederhana adalah workspace lokal yang disajikan gateway di port 8765. Jika ingin menghubungkan halaman online, sediakan sertifikat TLS yang dipercaya browser:

```sh
GATEWAY_CERT=/path/cert.pem GATEWAY_KEY=/path/key.pem npm run gateway
```

Kemudian gunakan `wss://hostname-yang-sesuai-sertifikat:8765`. Tambahkan origin editor ke `ALLOWED_ORIGINS` bila memakai domain sendiri. Jangan membagikan token atau membuka port Modbus ke internet.

## Wiring

Menu **Wiring** menghasilkan diagram hubungan tag scene–alamat PLC dan file SVG/CSV. Ini wiring logika I/O. Terminal daya, COM, PNP/NPN, kontak relay, dan pin CPU harus diambil dari manual CPU/modul yang benar; tidak disimpulkan dari alamat Modbus.

## Verifikasi

`npm run test:gateway` menjalankan server gateway dan client Modbus sungguhan pada loopback, lalu menguji baca sensor, tulis coil, STOP, watchdog, origin, dan token. Pengujian ini tidak membuktikan kompatibilitas dengan perangkat PLC fisik tertentu.
