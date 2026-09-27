# PLC Lab 3D — Virtual Factory & Ladder

Web-first **educational** PLC and factory simulator. Independent implementation inspired by typical industrial simulator workflows; not Factory I/O, and no proprietary Factory I/O assets are included.

## Fast start (no software installation)

1. Open the web app and choose **Template** to load the new Sorting Line lesson (especially if the browser already has an older saved scene).
2. Open **Ladder Editor** in the bottom panel. Example program: START sets M0; STOP resets M0; M0 energises conveyors, feeder and lamp; the photoelectric sensor starts T1 (TON, 0.25 s), which energises the pusher.
3. Click **RUN**, then **START** inside the Ladder panel (or click the button in the 3D scene). Click STOP to stop.
4. View current inputs, outputs and manually forced actuator states under **I/O Monitor**. Review timestamped changes in **Event Log**.
5. Click **EDIT** to change parts and rungs, then RUN again. Use **Save** for Neon cloud and browser autosave, or Export/Import JSON.

The PLC scans the scene's sensor/button input image, executes ladder rungs in order, writes the output image, then animates actuators/boxes. Implemented instructions: series NO/NC contacts, OUT, SET, RESET, TON, CTU and RES; eight memory bits, four timers and four counters. This is a small learning subset, **not** a complete IEC 61131-3 implementation or hardware-safety controller.

## Stack and storage

- Vite, JavaScript, Three.js and a browser-side VirtualPLC runtime.
- Neon PostgreSQL for optional scene/project storage. Configure server-only `DATABASE_URL` in Vercel and apply `db/schema.sql`.
- Every browser has its own locally generated workspace key. Projects and rungs autosave locally, but cloud save requires configured Neon. Export JSON for portability.
- Primitive component geometry is currently bundled. Optional cloud 3D asset library and physically detailed machine models are future work; Cloudflare R2 is not required by this version.
- No Supabase or Google Drive required.

## Physical PLC and wiring

Choose **PLC** to use the existing optional **local Modbus TCP gateway**, with the PLC acting as client/master and the gateway as server. See [gateway/README.md](gateway/README.md). This requires a local Node runtime and a reachable PLC; the cloud web editor itself needs no installation. On HTTPS, use a trusted WSS endpoint or the gateway's local workspace. Siemens S7/PLCSIM native, OPC UA, and browser-direct raw TCP are not implemented.

**Wiring** exports a logical I/O mapping as SVG/CSV, not a verified 24 V electrical terminal diagram. Physical wiring must follow the exact PLC and module datasheets.

## Development / test

```sh
npm ci
npm run check:syntax
npm test
npm run build
npm run dev
```

Tests cover virtual PLC latch, NO/NC, TON, CTU, forced output, legacy v1 project migration, and the existing Modbus TCP round trip, watchdog and token/origin protections.

## Current limitations

3D motion uses educational kinematics rather than industrial rigid-body physics. A browser consumes local GPU/RAM for rendering even when source and projects are stored in the cloud. The project will be expanded in small validated stages rather than claiming unsupported Ultimate Edition feature parity.
