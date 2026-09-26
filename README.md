# Factory I/O 3D Web Lab

Simulator pabrik berbasis browser untuk merancang scene, menjalankan conveyor, menguji sensor dan aktuator, menulis aturan kontrol, serta menyimpan proyek. Ini implementasi mandiri yang terinspirasi oleh alur kerja simulator industri; bukan produk resmi Factory I/O dan tidak memakai aset miliknya.

## Mulai

```bash
npm install
npm run dev
```

Di Vercel, impor repo ini dan tambahkan variabel server `DATABASE_URL` dari Neon (pooled). Jalankan `db/schema.sql` pada database Neon sebelum menyimpan proyek ke cloud. Tanpa variabel itu editor tetap bekerja dengan autosave lokal serta ekspor/impor JSON.

## Fitur versi ini

- Editor scene 3D WebGL berbasis Three.js: tempatkan, pilih, pindahkan, putar, duplikasi, hapus komponen; orbit, zoom dan pan.
- Conveyor, sensor fotoelektrik, stopper, pusher, lampu, tombol, emitter dan kotak kerja.
- Mode Edit/Run, pause, reset, kecepatan 0.25×–4×; tab tag I/O dan forcing aktuator.
- Aturan `WHEN sensor/flag THEN actuator = on/off`, termasuk kondisi inversi.
- Template scene, simpan lokal/Neon, ekspor/impor JSON.

## PLC dan wiring

- Gateway Modbus TCP lokal: PLC client membaca sensor virtual melalui FC02 dan menulis aktuator virtual melalui FC05/15.
- Pemetaan alamat per tag, ekspor CSV, diagram wiring logika SVG, token sesi, pembatasan origin, dan watchdog.
- Panduan lengkap: [gateway/README.md](gateway/README.md).
- Mulai: `npm ci`, `npm run build`, `npm run gateway`. Buka `http://127.0.0.1:8765` untuk workspace lokal dan masukkan token terminal.
- Uji protokol: `npm run test:gateway`.

## Batasan teknis

Ruang visual menggunakan model 3D sungguhan; pergerakan benda masih simulasi kinematik untuk latihan, belum rigid-body physics industri. Gateway Modbus berfungsi sebagai server; PLC perlu mode client/master. Driver S7/PLCSIM, OPC UA dan wiring terminal daya spesifik CPU belum tersedia. Diagram wiring yang diekspor adalah hubungan logika tag/alamat, bukan rangkaian daya.

Dokumentasi referensi: [Three.js OrbitControls](https://threejs.org/docs/pages/OrbitControls.html), [modbus-serial](https://github.com/yaacov/node-modbus-serial), [Factory I/O drivers](https://docs.factoryio.com/manual/drivers/).
