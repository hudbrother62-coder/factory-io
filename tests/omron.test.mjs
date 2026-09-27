import test from 'node:test';
import assert from 'node:assert/strict';
import {ensureOmronAddresses,normalizeCio,updateOmronAddress,labelFor,timerPreset,secondsFromPreset} from '../src/omron.js';
import {VirtualPLC,validProgram} from '../src/softplc.js';
const p=(id,type,address)=>({id,type,omronAddress:address,value:false});
test('Omron CIO profile preserves assigned addresses and generates unique input/output defaults',()=>{
 const scene={parts:[p('start','button','0.00'),p('stop','button','0.01'),p('sensor','sensor'),p('motor','conveyor','100.00'),p('lamp','lamp')]};
 ensureOmronAddresses(scene);
 assert.deepEqual(scene.parts.map(x=>x.omronAddress),['0.00','0.01','0.02','100.00','100.01']);
 assert.equal(labelFor(scene,'M0'),'W0.00');
 assert.equal(labelFor(scene,'T1'),'T0000');
 assert.equal(labelFor(scene,'C1'),'C0000');
});
test('CIO validator rejects duplicate and cross-direction addresses without mutation',()=>{
 const scene={parts:[p('start','button','0.00'),p('motor','conveyor','100.00'),p('lamp','lamp','100.01')]};
 assert.equal(normalizeCio('CIO 000.00'),'0.00');
 assert.throws(()=>updateOmronAddress(scene,'motor','0.02'),/tidak sesuai/);
 assert.throws(()=>updateOmronAddress(scene,'lamp','100.00'),/sudah digunakan/);
 assert.equal(scene.parts[2].omronAddress,'100.01');
 assert.equal(updateOmronAddress(scene,'lamp','Q:100.02'),'100.02');
});
test('parallel NO seal-in with NC stop behaves like CX-Programmer START/STOP rung',()=>{
 const scene={parts:[p('start','button','0.00'),p('stop','button','0.01'),p('motor','conveyor','100.00')],
  program:[
   {id:'seal',contacts:[{tag:'start',kind:'NO'},{tag:'stop',kind:'NC'}],branches:[[{tag:'M0',kind:'NO'},{tag:'stop',kind:'NC'}]],coil:{tag:'M0',mode:'OUT'}},
   {id:'motor',contacts:[{tag:'M0',kind:'NO'}],coil:{tag:'motor',mode:'OUT'}}
  ]};
 assert.equal(validProgram(scene.program,scene.parts),true);
 const plc=new VirtualPLC();
 plc.scan(scene,.02);assert.equal(scene.parts[2].value,false);
 scene.parts[0].value=true;plc.scan(scene,.02);assert.equal(scene.parts[2].value,true);
 scene.parts[0].value=false;plc.scan(scene,.02);assert.equal(scene.parts[2].value,true);
 scene.parts[1].value=true;plc.scan(scene,.02);assert.equal(scene.parts[2].value,false);
 scene.parts[1].value=false;plc.scan(scene,.02);assert.equal(scene.parts[2].value,false);
});
test('TIM preset is explicit 100 ms integer training unit',()=>{
 assert.equal(timerPreset(.5),'#0005');
 assert.equal(timerPreset(5),'#0050');
 assert.equal(secondsFromPreset('#0050'),5);
 assert.equal(secondsFromPreset('#0005'),.5);
 assert.equal(secondsFromPreset('#0000'),null);
 assert.equal(secondsFromPreset('#9999'),null);
});
test('reject invalid parallel contact references',()=>{
 const parts=[p('start','button','0.00'),p('motor','conveyor','100.00')];
 assert.equal(validProgram([{id:'x',contacts:[{tag:'start',kind:'NO'}],branches:[[{tag:'unknown',kind:'NO'}]],coil:{tag:'motor',mode:'OUT'}}],parts),false);
});
