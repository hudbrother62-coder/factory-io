import { FactoryView } from './view3d.js';
import { PlcLink } from './plc.js';
import { VirtualPLC, normaliseProgram, validProgram } from './softplc.js';
import { renderLadderEditor, updateLadderLive } from './ladder-ui.js';
import {ensureOmronAddresses,labelFor,updateOmronAddress,isMapped} from './omron.js';
import {renderOmronMapping,updateOmronLive} from './omron-ui.js';
const $ = (id) => document.getElementById(id);
const catalog = {
  conveyor: { name: 'Belt Conveyor', group: 'TRANSPORT', icon: '▰', desc: 'Memindahkan benda', color: '#cf9468', size: [3.4, 1.25], actuator: true },
  sensor: { name: 'Photoelectric', group: 'SENSORS', icon: '◉', desc: 'Deteksi benda', color: '#63d3c5', size: [.55, .55], sensor: true },
  stopper: { name: 'Stopper', group: 'ACTUATORS', icon: '▥', desc: 'Menahan benda', color: '#eab576', size: [.55, 1.15], actuator: true },
  pusher: { name: 'Pusher', group: 'ACTUATORS', icon: '⇥', desc: 'Dorong benda', color: '#e7a780', size: [.75, .85], actuator: true },
  emitter: { name: 'Box Emitter', group: 'MATERIAL', icon: '▣', desc: 'Keluarkan box', color: '#a3a5e3', size: [.9, .9], actuator: true },
  box: { name: 'Cardboard Box', group: 'MATERIAL', icon: '⬡', desc: 'Benda kerja', color: '#d9a36e', size: [.75, .75] },
  lamp: { name: 'Stack Light', group: 'SIGNALS', icon: '◍', desc: 'Indikator status', color: '#f0c86c', size: [.5, .5], actuator: true },
  button: { name: 'Push Button', group: 'SIGNALS', icon: '◌', desc: 'Input manual', color: '#e88f91', size: [.6, .6], sensor: true }
};
const initial = () => ({ parts: [
  { id: 'workpiece-a', type: 'box', x: -3.3, z: -.4, rotation: 0, name: 'Workpiece A', value: false },
  { id: 'workpiece-b', type: 'box', x: -1.7, z: -.4, rotation: 0, name: 'Workpiece B', value: false },
  { id: 'cv-a', type: 'conveyor', x: -2.8, z: -.4, rotation: 0, name: 'Infeed Conveyor', value: false, omronAddress:'100.00' },
  { id: 'cv-b', type: 'conveyor', x: .9, z: -.4, rotation: 0, name: 'Sorting Conveyor', value: false, omronAddress:'100.01' },
  { id: 'emit-a', type: 'emitter', x: -4.1, z: -.4, rotation: 0, name: 'Box Feeder', value: false, omronAddress:'100.02' },
  { id: 'sensor-a', type: 'sensor', x: .1, z: -.4, rotation: 0, name: 'Detection Sensor', value: false, omronAddress:'0.02' },
  { id: 'push-a', type: 'pusher', x: .25, z: -1.4, rotation: 0, name: 'Sorting Pusher', value: false, omronAddress:'100.03' },
  { id: 'stop-a', type: 'stopper', x: 3.3, z: -.4, rotation: 0, name: 'End Stopper', value: false, omronAddress:'100.04' },
  { id: 'lamp-a', type: 'lamp', x: 3.8, z: -2.2, rotation: 0, name: 'Run Indicator', value: false, omronAddress:'100.05' },
  { id: 'button-start', type: 'button', x: -4.8, z: 2.1, rotation: 0, name: 'START', value: false, omronAddress:'0.00' },
  { id: 'button-stop', type: 'button', x: -3.8, z: 2.1, rotation: 0, name: 'STOP', value: false, omronAddress:'0.01' }
], rules: [], program: [
  {id:'r-seal',contacts:[{tag:'button-start',kind:'NO'},{tag:'button-stop',kind:'NC'}],branches:[[{tag:'M0',kind:'NO'},{tag:'button-stop',kind:'NC'}]],coil:{tag:'M0',mode:'OUT'}},
  {id:'r-infeed',contacts:[{tag:'M0',kind:'NO'}],coil:{tag:'cv-a',mode:'OUT'}},
  {id:'r-sort',contacts:[{tag:'M0',kind:'NO'}],coil:{tag:'cv-b',mode:'OUT'}},
  {id:'r-feeder',contacts:[{tag:'M0',kind:'NO'}],coil:{tag:'emit-a',mode:'OUT'}},
  {id:'r-delay',contacts:[{tag:'sensor-a',kind:'NO'}],coil:{tag:'T1',mode:'TON',pt:.5}},
  {id:'r-push',contacts:[{tag:'T1',kind:'NO'},{tag:'M0',kind:'NO'}],coil:{tag:'push-a',mode:'OUT'}},
  {id:'r-lamp',contacts:[{tag:'M0',kind:'NO'}],coil:{tag:'lamp-a',mode:'OUT'}}
], profile:'omron-cp1e', version: 3 });
const saved = (() => { try { return JSON.parse(localStorage.getItem('factory-scene') || 'null'); } catch { return null; } })();
let scene = validScene(saved?.scene) ? saved.scene : initial();
scene.program = normaliseProgram(scene);
ensureOmronAddresses(scene);
let projectId = saved?.id || null;
let mode = 'edit', paused = false, selected = null, placing = null, activeTab = 'ladder';
let camera = { x: 0, y: 25, zoom: 1 }, mouse = { x: 0, y: 0 }, dragging = null;
let sim = { time: 0, boxes: [], events: [], emitterClock: 0, sensorStates: {} };
let toastTimer, dirty = false, frameLast = 0, dpr = 1;
const canvas = $('stage');
const view = new FactoryView(canvas);
// UI-only preferences; never change scene, project data or cloud storage.
const layoutKey='factory-layout-v1';
const savedLayout=(()=>{try{return JSON.parse(localStorage.getItem(layoutKey)||'null');}catch{return null;}})();
let uiPanels={library:savedLayout?.library??(window.innerWidth>820),inspector:savedLayout?.inspector??(window.innerWidth>1350)};
function updateLayout(persist=false){
 const app=$('app');app.classList.toggle('hide-library',!uiPanels.library);app.classList.toggle('hide-inspector',!uiPanels.inspector);
 $('library-toggle').setAttribute('aria-pressed',String(uiPanels.library));$('inspector-toggle').setAttribute('aria-pressed',String(uiPanels.inspector));
 $('library-toggle').classList.toggle('active',uiPanels.library);$('inspector-toggle').classList.toggle('active',uiPanels.inspector);
 $('focus-btn').setAttribute('aria-pressed',String(app.classList.contains('focus-3d')));
 $('focus-btn').classList.toggle('active',app.classList.contains('focus-3d'));
 if(persist)localStorage.setItem(layoutKey,JSON.stringify(uiPanels));
 requestAnimationFrame(()=>view.resize());
}
function showPropertiesAfterPick(){
 if(window.innerWidth<=1350&&!uiPanels.inspector&&!$('app').classList.contains('focus-3d')){uiPanels.inspector=true;if(window.innerWidth<=1190)uiPanels.library=false;updateLayout(true);}
}
if(typeof ResizeObserver!=='undefined')new ResizeObserver(()=>view.resize()).observe(canvas.parentElement);
const virtual = new VirtualPLC();
const plc = new PlcLink({scene:()=>scene,notify,changed:markDirty,isRunning:()=>mode==='run'&&!paused});
const key = (() => { let v = localStorage.getItem('factory-workspace-key'); if (!v) { v = [...crypto.getRandomValues(new Uint8Array(32))].map(x => x.toString(16).padStart(2, '0')).join(''); localStorage.setItem('factory-workspace-key', v); } return v; })();
const safe = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid = () => crypto.randomUUID();
function validScene(s) { return s && Array.isArray(s.parts) && s.parts.length <= 250 && s.parts.every(p => p && catalog[p.type] && typeof p.x === 'number' && Number.isFinite(p.x) && Math.abs(p.x) < 100 && typeof p.z === 'number' && Number.isFinite(p.z) && Math.abs(p.z) < 100 && typeof p.id === 'string') && Array.isArray(s.rules) && s.rules.length <= 100 && validProgram(normaliseProgram(s),s.parts); }
function notify(s) { $('toast').textContent = s; $('toast').classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').classList.remove('show'), 2700); }
function closeModal(){ $('modal-backdrop').classList.add('hidden');document.querySelector('.modal').classList.remove('guide-mode'); }
function showGuide(){
 const host=$('modal-content');document.querySelector('.modal').classList.add('guide-mode');$('modal-backdrop').classList.remove('hidden');document.querySelector('.modal-head h2').textContent='Panduan Omron CP1E — dari CX-Programmer ke 3D';
 host.innerHTML=`<div class="guide-intro"><strong>Belajar dengan alur familiar CX-Programmer</strong><p>Pilih Latihan CP1E untuk melihat contoh self-holding: START CIO 0.00, STOP CIO 0.01 (kontak NC pada Ladder), pengunci W0.00, motor CIO 100.00. Ini PLC virtual, bukan software atau hardware Omron resmi.</p></div><div class="guide-grid">
 <article><span>01 · BANGUN SCENE</span><h3>Tambah dan edit mesin</h3><p>Klik <b>EDIT SCENE</b>, pilih Conveyor/Sensor dari panel kiri, lalu klik area 3D. Klik objek untuk mengubah nama, X/Z dan rotasi di panel kanan.</p><button data-guide="edit">Buka mode Edit →</button></article>
 <article><span>02 · PROGRAM PLC</span><h3>Susun Ladder seperti CX</h3><p>Buka panel bawah, tekan <b>+ NETWORK</b>. Gunakan kontak NO/NC, cabang paralel untuk pengunci, OUT, SET/RSET, TIM (#0005 = 0,5 detik) atau CNT.</p><button data-guide="ladder">Buka Ladder Editor →</button></article>
 <article><span>03 · UJI MESIN</span><h3>Uji program CP1E virtual</h3><p>Tekan RUN SIMULASI lalu tombol <b>0.00 START</b> dalam Ladder. Periksa motor 100.00, kemudian klik 0.01 STOP. Kontak dan output mengikuti scan virtual.</p><button data-guide="run">Coba simulasi →</button></article>
 <article><span>04 · KONEKSI DAN SIMPAN</span><h3>Alamat CIO dan penyimpanan</h3><p>Tab ALAMAT CP1E untuk mengganti alamat CIO input/output; W untuk bit kerja, T untuk timer, C untuk counter. Mapping Modbus eksternal berbeda. Simpan atau ekspor JSON.</p><button data-guide="mapping">Lihat mapping I/O →</button></article></div><div class="guide-bottom"><span>Tips: F5 = Edit/Run · R = putar objek · Delete = hapus · Esc = tutup dialog.</span><button data-guide="close">Mengerti, tutup</button></div>`;
 host.querySelectorAll('[data-guide]').forEach(btn=>btn.onclick=()=>{const a=btn.dataset.guide;closeModal();if(a==='edit'){setMode('edit');notify('Pilih mesin dari kiri, klik grid, lalu pilih mesin untuk mengatur Properties.');}if(a==='ladder'){activeTab='ladder';document.querySelectorAll('.panel-tabs button').forEach(b=>b.classList.toggle('active',b.dataset.tab==='ladder'));renderPanel();$('panel-content').scrollTop=0;notify('Untuk mengedit: pilih dropdown pada rung atau tekan + RUNG.');}if(a==='run'){setMode('run');activeTab='ladder';document.querySelectorAll('.panel-tabs button').forEach(b=>b.classList.toggle('active',b.dataset.tab==='ladder'));renderPanel();notify('Sekarang klik START di bagian kanan atas panel Ladder.');}if(a==='mapping'){activeTab='omron';document.querySelectorAll('.panel-tabs button').forEach(b=>b.classList.toggle('active',b.dataset.tab==='omron'));renderPanel();notify('Ubah alamat CIO dari tab ALAMAT CP1E saat mode EDIT.');}});
 localStorage.setItem('factory-guide-cp1e-v1-seen','1');
}
function markDirty() { ensureOmronAddresses(scene); dirty = true; $('save-status').textContent = 'Perubahan belum disimpan ke cloud'; localStorage.setItem('factory-scene', JSON.stringify({ id: projectId, title: $('scene-name').value, scene })); renderPalette(); renderInspector(); renderPanel(); }
function log(s) { sim.events.unshift({ time: sim.time.toFixed(1), message: s }); sim.events.length = Math.min(sim.events.length, 60); if (activeTab === 'events') renderPanel(); }
function setMode(next) { if (mode === next) return; mode = next; paused = false; placing = null; selected = null; if (next === 'run') { resetSim(); log('Virtual PLC simulation started'); } else resetSim(); $('edit-btn').classList.toggle('active', next === 'edit'); $('run-btn').classList.toggle('active', next === 'run'); $('pause-btn').disabled = next !== 'run'; $('mode-indicator').classList.toggle('running', next === 'run'); $('mode-label').textContent = next === 'run' ? 'SIMULATION RUNNING' : 'EDITOR MODE'; $('engine-status').textContent = next === 'run' ? 'RUNNING' : 'READY'; renderPalette(); renderInspector(); renderPanel(); $('lesson-tip').innerHTML=next==='run'?'CP1E RUN: klik CIO 0.00 START, lihat CIO 100.00 bergerak; CIO 0.01 STOP untuk berhenti. <button id="lesson-help" type="button">Panduan →</button>':'CP1E EDIT: buka Ladder dan ALAMAT CP1E untuk menyiapkan program serta tag CIO. <button id="lesson-help" type="button">Panduan →</button>'; $('lesson-help').onclick=showGuide; }
function resetSim() { virtual.reset();sim = { time: 0, boxes: scene.parts.filter(p => p.type === 'box').map(p => ({ id: uid(), x: p.x, z: p.z, pushed: false })), events: [], emitterClock: 0, sensorStates: {} }; for (const p of scene.parts) { if (catalog[p.type]?.sensor||catalog[p.type]?.actuator) {p.value=false;p.forced=false;} } renderPanel(); }
function draw(){view.sync(scene.parts,sim.boxes,selected,mode==='run');}
function resize(){view.resize();}
function step(dt){
 if(mode!=='run'||paused)return;
 dt=Math.min(dt,.07)*Number($('speed').value);sim.time+=dt;
 // Inputs are sampled from the 3D scene before the PLC executes.
 for(const s of scene.parts.filter(p=>p.type==='sensor')){
  const hit=sim.boxes.some(b=>Math.abs(b.x-s.x)<.46&&Math.abs(b.z-s.z)<.6);
  if(Boolean(s.value)!==hit){s.value=hit;log(s.name+': '+(hit?'ON':'OFF'));}
 }
 if(!plc.enabled){
  const slices=Math.max(1,Math.ceil(dt/.05));
  for(let i=0;i<slices;i++)virtual.scan(scene,dt/slices);
 }
 // Only an energised emitter can produce workpieces.
 const emitters=scene.parts.filter(p=>p.type==='emitter'&&p.value);
 sim.emitterClock=emitters.length?sim.emitterClock+dt:0;
 if(sim.emitterClock>=2.8&&sim.boxes.length<40){
  for(const p of emitters)if(!sim.boxes.some(b=>Math.abs(b.x-p.x)<.8&&Math.abs(b.z-p.z)<.8)){
   sim.boxes.push({id:uid(),x:p.x,z:p.z,pushed:false});log(p.name+': box emitted');
  }
  sim.emitterClock=0;
 }
 for(const b of sim.boxes){
  const local=p=>{const r=(p.rotation||0)*Math.PI/2,dx=b.x-p.x,dz=b.z-p.z;return{u:dx*Math.cos(r)+dz*Math.sin(r),v:-dx*Math.sin(r)+dz*Math.cos(r),r};};
  const cv=scene.parts.find(p=>{if(p.type!=='conveyor'||!p.value)return false;const l=local(p);return Math.abs(l.v)<.57&&Math.abs(l.u)<1.95;});
  const stopped=scene.parts.some(p=>p.type==='stopper'&&p.value&&Math.hypot(b.x-p.x,b.z-p.z)<.58);
  if(cv&&!stopped){const r=(cv.rotation||0)*Math.PI/2;b.x+=dt*.88*Math.cos(r);b.z+=dt*.88*Math.sin(r);}
  const push=scene.parts.find(p=>{if(p.type!=='pusher'||!p.value)return false;const l=local(p);return Math.abs(l.u)<.55&&l.v>0&&l.v<1.7;});
  if(push){const r=(push.rotation||0)*Math.PI/2;b.x-=dt*1.55*Math.sin(r);b.z+=dt*1.55*Math.cos(r);}
 }
 sim.boxes=sim.boxes.filter(b=>Math.abs(b.x)<13&&Math.abs(b.z)<13);
 $('sim-time').textContent='SIM TIME '+String(Math.floor(sim.time/60)).padStart(2,'0')+':'+(sim.time%60).toFixed(1).padStart(4,'0');
}
function frame(t){const dt=frameLast?(t-frameLast)/1000:0;frameLast=t;step(dt);draw();requestAnimationFrame(frame);}requestAnimationFrame(frame);
function renderPalette(){let groups={};for(const [type,p] of Object.entries(catalog))(groups[p.group]??=[]).push([type,p]);$('palette').innerHTML=Object.entries(groups).map(([group,parts])=>`<div class="palette-section"><div class="section-label">${group}</div>${parts.map(([type,p])=>`<button class="palette-item ${placing===type?'selected':''}" data-part="${type}" ${mode==='run'?'disabled':''}><span class="part-icon">${p.icon}</span><span><strong>${p.name}</strong><small>${p.desc}</small></span></button>`).join('')}</div>`).join('');$('part-count').textContent=String(Object.keys(catalog).length).padStart(2,'0');$('palette').querySelectorAll('[data-part]').forEach(b=>b.onclick=()=>{placing=placing===b.dataset.part?null:b.dataset.part;selected=null;renderPalette();renderInspector();$('stage-hint').textContent=placing?'Klik grid untuk menempatkan · Esc batal':'Pilih komponen di kiri untuk mulai membangun';});}
function renderInspector(){const host=$('inspector-content');const p=scene.parts.find(p=>p.id===selected);if(!p){host.innerHTML=`<div class="inspector-empty"><span class="empty-graphic">${mode==='run'?'▶':'✎'}</span><h3>${mode==='run'?'Simulasi aktif':'Cara mengedit objek'}</h3><p>${mode==='run'?'Tekan START di panel Ladder, lalu perhatikan status I/O dan pergerakan mesin.':'1. Pilih komponen di Asset Library sebelah kiri.<br>2. Klik lantai 3D untuk menambahkan.<br>3. Klik objek untuk mengatur posisi, nama, dan rotasi di sini.'}</p><button id="inspector-guide" class="inspector-guide">${mode==='run'?'Buka panduan simulasi':'Lihat cara edit →'}</button></div>`;host.querySelector('#inspector-guide').onclick=showGuide;return;}host.innerHTML=`<div class="inspector-content"><h2>${safe(p.name)}</h2><div class="type-name">${safe(catalog[p.type].name)}</div><div class="prop-group"><span class="prop-label">IDENTITY</span><div class="prop-field"><label>Nama tag / objek</label><input id="prop-name" maxlength="60" value="${safe(p.name)}" ${mode==='run'?'disabled':''}></div><div class="prop-field"><label>Tipe komponen</label><input value="${safe(catalog[p.type].name)}" disabled></div></div><div class="prop-group"><span class="prop-label">TRANSFORM</span><div class="row-fields"><div class="prop-field"><label>Posisi X</label><input id="prop-x" type="number" min="-30" max="30" step="0.5" value="${p.x}" ${mode==='run'?'disabled':''}></div><div class="prop-field"><label>Posisi Z</label><input id="prop-z" type="number" min="-30" max="30" step="0.5" value="${p.z}" ${mode==='run'?'disabled':''}></div></div><div class="prop-field"><label>Rotasi</label><select id="prop-rotation" ${mode==='run'?'disabled':''}>${[0,90,180,270].map((v,i)=>`<option value="${i}" ${p.rotation===i?'selected':''}>${v}°</option>`).join('')}</select></div></div>${catalog[p.type].actuator||catalog[p.type].sensor?`<div class="prop-group"><span class="prop-label">I/O STATE</span><div class="tag-card"><div><small>${safe(labelFor(scene,p.id))} · ${catalog[p.type].sensor?'INPUT':'OUTPUT'}</small><strong>${safe(p.name)}</strong></div><span class="tag-value ${p.value?'on':''}">${p.value?'ON':'OFF'}</span></div></div>`:''}${mode==='edit'?`<div class="inspector-actions"><button id="duplicate-part">⧉ Duplikat</button><button id="remove-part" class="danger">⌫ Hapus</button></div>`:''}</div>`;
  if(mode==='edit'){for(const field of ['name','x','z','rotation']){const el=$(`prop-${field}`);el.onchange=()=>{let v=field==='name'?el.value.trim().slice(0,60):Number(el.value);if(field==='name'&&!v)v=catalog[p.type].name;if(field==='x'||field==='z')v=Math.min(30,Math.max(-30,Number.isFinite(v)?v:0));p[field]=v;markDirty();};} $('duplicate-part').onclick=()=>{const copy={...p,id:uid(),name:p.name+' copy',x:p.x+1,z:p.z+1};delete copy.omronAddress;scene.parts.push(copy);ensureOmronAddresses(scene);selected=copy.id;markDirty();};$('remove-part').onclick=removeSelected;}}
function pulseButton(id){if(mode!=='run'||paused)return notify('Tekan RUN dahulu untuk memakai tombol mesin.');const p=scene.parts.find(x=>x.id===id&&x.type==='button');if(!p)return;p.value=true;log(p.name+': pressed');setTimeout(()=>{if(scene.parts.includes(p)){p.value=false;if(activeTab==='io')renderPanel();}},250);}
function ioTags(){return scene.parts.filter(p=>catalog[p.type].sensor||catalog[p.type].actuator);}
function renderPanel(){const host=$('panel-content');if(activeTab==='omron')return renderOmronMapping(host,scene,virtual,{changed:markDirty,notify,editable:mode==='edit'});if(activeTab==='io'){const tags=ioTags();host.innerHTML=tags.length?`<button id="release-forces" class="release-forces">Lepas semua force</button><div class="monitor-grid">${tags.map(p=>`<div class="tag-card"><div><small>${safe(labelFor(scene,p.id))} · ${catalog[p.type].sensor?'INPUT':'OUTPUT'}</small><strong title="${safe(p.name)}">${safe(p.name)}</strong></div><button class="tag-value ${p.value?'on':''} ${catalog[p.type].actuator?'force':''}" data-toggle="${safe(p.id)}" data-io-value="${safe(p.id)}" title="${catalog[p.type].actuator?'Klik untuk force tag':'Input sensor'}">${p.value?'ON':'OFF'}</button></div>`).join('')}</div>`:'<div class="empty-panel">Tambahkan sensor atau aktuator untuk melihat tag I/O.</div>';const release=host.querySelector('#release-forces');if(release)release.onclick=()=>{for(const p of scene.parts)p.forced=false;notify('Semua force dilepas.');};host.querySelectorAll('[data-toggle]').forEach(btn=>btn.onclick=()=>{const p=scene.parts.find(x=>x.id===btn.dataset.toggle);if(!p||!catalog[p.type].actuator)return;if(plc.enabled)return notify('Mode PLC aktif: aktuator mengikuti coil dari PLC.');p.value=!p.value;p.forced=true;log(`${p.name}: forced ${p.value?'ON':'OFF'}`);markDirty();});}
  else if(activeTab==='events')host.innerHTML=sim.events.length?sim.events.map(e=>`<div class="event-row"><time>${safe(e.time)}s</time><span>${safe(e.message)}</span></div>`).join(''):'<div class="empty-panel">Peristiwa simulasi akan muncul di sini. Tekan RUN untuk memulai.</div>';
  else renderLadderEditor(host,scene,virtual,{changed:markDirty,pulse:pulseButton,editable:mode==='edit'});
}
// Update only live values; do not rebuild the panel every 250 ms or destroy its scroll position.
function updateIoLive(){
 const host=$('panel-content');
 for(const btn of host.querySelectorAll('[data-io-value]')){
  const p=scene.parts.find(x=>x.id===btn.dataset.ioValue);if(!p)continue;
  btn.textContent=p.value?'ON':'OFF';btn.classList.toggle('on',Boolean(p.value));
 }
}
}
function removeSelected(){if(!selected||mode==='run')return;scene.parts=scene.parts.filter(p=>p.id!==selected);scene.rules=scene.rules.filter(r=>r.source!==selected&&r.target!==selected);scene.program=normaliseProgram(scene).filter(r=>r.coil.tag!==selected&&!r.contacts.some(c=>c.tag===selected)&&!(r.branches||[]).some(branch=>branch.some(c=>c.tag===selected)));selected=null;markDirty();}
function pick(x,y){const id=view.pick(x,y);return scene.parts.find(p=>p.id===id);}
canvas.addEventListener('pointerdown',e=>{
 const rect=canvas.getBoundingClientRect();mouse={x:e.clientX-rect.left,y:e.clientY-rect.top};
 if(e.button!==0)return;
 if(mode==='edit'&&placing){view.controls.enabled=false;const w=view.ground(mouse.x,mouse.y),type=placing;if(scene.parts.length>=250)return notify('Maksimal 250 komponen.');const part={id:uid(),type,x:Math.round(w.x*2)/2,z:Math.round(w.z*2)/2,rotation:0,name:catalog[type].name+' '+(scene.parts.filter(p=>p.type===type).length+1),value:['conveyor','emitter'].includes(type)};scene.parts.push(part);ensureOmronAddresses(scene);selected=part.id;placing=null;showPropertiesAfterPick();markDirty();notify(part.name+' ditambahkan. Atur posisi, nama dan rotasinya di Properties sebelah kanan.');return;}
 const p=pick(mouse.x,mouse.y);
 if(mode==='edit'){selected=p?.id||null;if(p)showPropertiesAfterPick();renderInspector();if(p){$('stage-hint').textContent='Objek terpilih · ubah Properties di kanan atau seret untuk memindahkan';view.controls.enabled=false;const start=view.ground(mouse.x,mouse.y);dragging={id:p.id,start,originalX:p.x,originalZ:p.z};}}
 else if(p?.type==='button'){pulseButton(p.id);renderPanel();}
},true);
canvas.addEventListener('pointermove',e=>{const rect=canvas.getBoundingClientRect();mouse={x:e.clientX-rect.left,y:e.clientY-rect.top};const w=view.ground(mouse.x,mouse.y);$('hover-coords').textContent=`X ${w.x.toFixed(1)} · Z ${w.z.toFixed(1)}`;if(dragging){const p=scene.parts.find(p=>p.id===dragging.id);if(p){p.x=Math.max(-30,Math.min(30,Math.round((dragging.originalX+w.x-dragging.start.x)*2)/2));p.z=Math.max(-30,Math.min(30,Math.round((dragging.originalZ+w.z-dragging.start.z)*2)/2));}}});
const endDrag=()=>{if(dragging)markDirty();dragging=null;view.controls.enabled=true;};window.addEventListener('pointerup',endDrag);canvas.addEventListener('pointercancel',endDrag);
document.addEventListener('keydown',e=>{if(['INPUT','SELECT','TEXTAREA'].includes(document.activeElement?.tagName))return;if(e.key==='F5'){e.preventDefault();setMode(mode==='edit'?'run':'edit');}if(e.key==='Escape'){placing=null;renderPalette();}if((e.key==='Delete'||e.key==='Backspace')&&selected)removeSelected();if(e.key.toLowerCase()==='r'&&selected&&mode==='edit'){const p=scene.parts.find(p=>p.id===selected);p.rotation=(p.rotation+1)%4;markDirty();}});
function template(){if(scene.parts.length&&!confirm('Ganti scene saat ini dengan template Sorting Line? Simpan atau ekspor dulu bila perlu.'))return;scene=ensureOmronAddresses(initial());projectId=null;selected=null;setMode('edit');resetSim();$('scene-name').value='CP1E · Conveyor Sorting Line';markDirty();notify('Latihan CP1E baru dimuat. START 0.00, STOP 0.01, W0.00 pengunci, motor 100.00.');}
function download(){const data={format:'factory-web-lab',version:1,title:$('scene-name').value,scene};const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=($('scene-name').value.toLowerCase().replace(/[^a-z0-9]+/g,'-')||'factory-scene')+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);notify('File proyek berhasil diekspor.');}
async function cloud(method='GET',payload){const r=await fetch('/api/projects'+(method==='DELETE'?`?id=${encodeURIComponent(payload)}`:''),{method,headers:{'Content-Type':'application/json','x-workspace-key':key},body:method==='PUT'?JSON.stringify(payload):undefined});if(!r.ok){const data=await r.json().catch(()=>({}));throw Error(data.error||`Server ${r.status}`);}return r.status===204?{}:r.json();}
async function save(){localStorage.setItem('factory-scene',JSON.stringify({id:projectId,title:$('scene-name').value,scene}));$('save-status').textContent='Tersimpan lokal · menyimpan ke Neon…';try{const result=await cloud('PUT',{id:projectId,title:$('scene-name').value,scene});projectId=result.id;dirty=false;localStorage.setItem('factory-scene',JSON.stringify({id:projectId,title:$('scene-name').value,scene}));$('save-status').textContent='Tersimpan lokal + Neon';notify('Scene tersimpan ke Neon.');}catch(e){$('save-status').textContent='Tersimpan lokal · Neon belum aktif';notify(e.message);}}
async function projects(){document.querySelector('.modal-head h2').textContent='Proyek saya';const modal=$('modal-backdrop'),host=$('modal-content');modal.classList.remove('hidden');host.innerHTML='<div class="modal-actions"><button id="new-scene">+ Scene baru</button><button id="export-modal">↧ Ekspor scene</button></div><p class="modal-note">Scene aktif tersimpan otomatis di browser ini. Gunakan Simpan scene untuk menyinkronkan ke Neon. Kunci workspace tersimpan di browser ini, jadi ekspor JSON sebagai cadangan saat pindah perangkat.</p><div id="cloud-list">Memuat proyek Neon…</div>';$('new-scene').onclick=()=>{if(!confirm('Buat scene kosong? Perubahan yang belum disimpan akan diganti.'))return;scene={parts:[],rules:[],program:[],profile:'omron-cp1e',version:3};projectId=null;selected=null;setMode('edit');$('scene-name').value='Scene Baru';markDirty();modal.classList.add('hidden');};$('export-modal').onclick=download;try{const {projects}=await cloud();$('cloud-list').innerHTML=projects.length?projects.map(p=>`<div class="project-row"><div><strong>${safe(p.title)}</strong><small>${new Date(p.updated_at).toLocaleString('id-ID')} · ${p.scene.parts.length} komponen</small></div><div><button data-open="${safe(p.id)}">Buka</button> <button class="danger" data-delete="${safe(p.id)}">Hapus</button></div></div>`).join(''):'<p class="modal-note">Belum ada proyek di Neon.</p>';host.querySelectorAll('[data-open]').forEach(b=>b.onclick=()=>{const p=projects.find(x=>x.id===b.dataset.open);if(!p||!validScene(p.scene))return notify('Format scene tidak valid.');scene=ensureOmronAddresses(p.scene);scene.program=normaliseProgram(scene);projectId=p.id;selected=null;setMode('edit');resetSim();$('scene-name').value=p.title;markDirty();dirty=false;$('save-status').textContent='Dimuat dari Neon';modal.classList.add('hidden');});host.querySelectorAll('[data-delete]').forEach(b=>b.onclick=async()=>{if(!confirm('Hapus proyek cloud ini secara permanen?'))return;try{await cloud('DELETE',b.dataset.delete);if(projectId===b.dataset.delete)projectId=null;notify('Proyek cloud dihapus.');projectsModalRefresh();}catch(e){notify(e.message);}});}catch(e){$('cloud-list').innerHTML=`<p class="cloud-message">${safe(e.message)}</p>`;}}
function projectsModalRefresh(){projects();}
$('scene-name').value=saved?.title||'CP1E · Conveyor Sorting Line';$('scene-name').oninput=markDirty;$('edit-btn').onclick=()=>setMode('edit');$('run-btn').onclick=()=>setMode('run');$('pause-btn').onclick=()=>{paused=!paused;$('pause-btn').textContent=paused?'▷':'Ⅱ';$('mode-label').textContent=paused?'SIMULATION PAUSED':'SIMULATION RUNNING';log(paused?'Simulation paused':'Simulation resumed');};$('reset-btn').onclick=()=>{resetSim();log('Simulation reset');notify('Simulasi direset.');};$('template-btn').onclick=template;$('export-btn').onclick=download;$('save-btn').onclick=save;$('projects-btn').onclick=projects;$('close-modal').onclick=closeModal;$('modal-backdrop').onclick=e=>{if(e.target===$('modal-backdrop'))closeModal();};$('fit-btn').onclick=()=>view.reset();$('zoom-in').onclick=()=>view.zoom(.85);$('zoom-out').onclick=()=>view.zoom(1.15);$('theme-btn').onclick=()=>{document.body.classList.toggle('light');localStorage.setItem('factory-theme',document.body.classList.contains('light')?'light':'dark');};if(localStorage.getItem('factory-theme')==='light')document.body.classList.add('light');$('import-input').onchange=async e=>{const f=e.target.files?.[0];if(!f)return;try{if(f.size>200000)throw Error('File terlalu besar.');const data=JSON.parse(await f.text());if(!validScene(data.scene))throw Error('Format scene tidak valid.');scene=ensureOmronAddresses(data.scene);scene.program=normaliseProgram(scene);projectId=null;selected=null;setMode('edit');resetSim();$('scene-name').value=String(data.title||'Scene impor').slice(0,100);markDirty();notify('Scene diimpor.');}catch(err){notify(err.message);}e.target.value='';};document.querySelectorAll('.panel-tabs button').forEach(b=>b.onclick=()=>{activeTab=b.dataset.tab;document.querySelectorAll('.panel-tabs button').forEach(x=>x.classList.toggle('active',x===b));renderPanel();});renderPalette();renderInspector();renderPanel();resize();

$('help-btn').onclick=showGuide;$('lesson-help').onclick=showGuide;
$('library-toggle').onclick=()=>{$('app').classList.remove('focus-3d');uiPanels.library=!uiPanels.library;updateLayout(true);};
$('inspector-toggle').onclick=()=>{$('app').classList.remove('focus-3d');uiPanels.inspector=!uiPanels.inspector;updateLayout(true);};
$('focus-btn').onclick=()=>{$('app').classList.toggle('focus-3d');updateLayout();};
$('panel-collapse').onclick=()=>{const collapsed=$('app').classList.toggle('panel-collapsed');$('panel-collapse').textContent=collapsed?'⌃':'⌄';$('panel-collapse').setAttribute('aria-label',collapsed?'Tampilkan panel bawah':'Sembunyikan panel bawah');requestAnimationFrame(()=>view.resize());};
$('tools-menu').querySelector('.tools-popover').addEventListener('click',e=>{if(e.target.closest('button, label'))$('tools-menu').open=false;});
updateLayout();
$('expand-panel').onclick=()=>{const expanded=$('app').classList.toggle('editor-expanded');$('expand-panel').innerHTML=expanded?'↙ <span>Perkecil editor</span>':'↗ <span>Perbesar editor</span>';view.resize();};
document.addEventListener('keydown',e=>{if(e.key==='F1'){e.preventDefault();showGuide();}if(e.key==='Escape'&&!$('modal-backdrop').classList.contains('hidden')){e.preventDefault();closeModal();}else if(e.key==='Escape'){$('tools-menu').open=false;}});
if(!localStorage.getItem('factory-guide-cp1e-v1-seen'))showGuide();
$('plc-btn').onclick=()=>plc.open();
$('wiring-btn').onclick=()=>plc.wiring();
setInterval(()=>{if(activeTab==='io'&&mode==='run')updateIoLive();if(activeTab==='omron'&&mode==='run')updateOmronLive($('panel-content'),scene,virtual);if(activeTab==='ladder'&&mode==='run')updateLadderLive($('panel-content'),virtual);plc.status();},250);
