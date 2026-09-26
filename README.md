# Factory I/O Web Lab

Simulator pabrik berbasis browser untuk merancang scene, menjalankan conveyor, menguji sensor dan aktuator, menulis aturan kontrol, serta menyimpan proyek. Ini implementasi mandiri yang terinspirasi oleh alur kerja simulator industri; bukan produk resmi Factory I/O dan tidak memakai aset miliknya.

## Mulai

```bash
npm install
npm run dev
```

Di Vercel, impor repo ini dan tambahkan variabel server `DATABASE_URL` dari Neon (pooled). Jalankan `db/schema.sql` pada database Neon sebelum menyimpan proyek ke cloud. Tanpa variabel itu editor tetap bekerja dengan autosave lokal serta ekspor/impor JSON.

## Fitur versi ini

- Editor scene isometrik berbasis Canvas: tempatkan, pilih, pindahkan, putar, duplikasi, hapus komponen; zoom dan pan.
- Conveyor, sensor fotoelektrik, stopper, pusher, lampu, tombol, emitter dan kotak kerja.
- Mode Edit/Run, pause, reset, kecepatan 0.25×–4×; tab tag I/O dan forcing aktuator.
- Aturan `WHEN sensor/flag THEN actuator = on/off`, termasuk kondisi inversi.
- Template scene, simpan lokal/Neon, ekspor/impor JSON.

## Batasan teknis

Simulasi merupakan model pedagogis 2.5D, belum fisika 3D presisi, scene resmi, PLC industri, Modbus, OPC UA, atau Siemens. Browser tidak bisa langsung mengakses jaringan PLC pengguna dari fungsi Vercel. Integrasi PLC memerlukan gateway lokal yang disetujui pengguna, otentikasi, dan pengujian perangkat terpisah.
