import test from 'node:test';
import assert from 'node:assert/strict';
import {VirtualPLC,normaliseProgram,validProgram} from '../src/softplc.js';
const p=(id,type,value=false)=>({id,type,value});
test('sensor image drives output; NC contact inverts input',()=>{
 const s={parts:[p('i','sensor'),p('q','conveyor')],program:[{id:'r1',contacts:[{tag:'i',kind:'NO'}],coil:{tag:'q',mode:'OUT'}}]};const plc=new VirtualPLC();
 plc.scan(s,.02);assert.equal(s.parts[1].value,false);s.parts[0].value=true;plc.scan(s,.02);assert.equal(s.parts[1].value,true);
 s.program[0].contacts[0].kind='NC';plc.scan(s,.02);assert.equal(s.parts[1].value,false);
});
test('SET/RESET memory latch and STOP priority',()=>{
 const s={parts:[p('start','button'),p('stop','button'),p('motor','conveyor')],program:[{id:'a',contacts:[{tag:'start',kind:'NO'}],coil:{tag:'M0',mode:'SET'}},{id:'b',contacts:[{tag:'stop',kind:'NO'}],coil:{tag:'M0',mode:'RESET'}},{id:'c',contacts:[{tag:'M0',kind:'NO'}],coil:{tag:'motor',mode:'OUT'}}]};
 const plc=new VirtualPLC();s.parts[0].value=true;plc.scan(s,.02);s.parts[0].value=false;plc.scan(s,.02);assert.equal(s.parts[2].value,true);s.parts[1].value=true;plc.scan(s,.02);assert.equal(s.parts[2].value,false);
});
test('TON delays output then clears on falling input',()=>{
 const s={parts:[p('i','sensor',true),p('q','pusher')],program:[{id:'t',contacts:[{tag:'i',kind:'NO'}],coil:{tag:'T1',mode:'TON',pt:.3}},{id:'o',contacts:[{tag:'T1',kind:'NO'}],coil:{tag:'q',mode:'OUT'}}]};
 const plc=new VirtualPLC();plc.scan(s,.1);plc.scan(s,.1);assert.equal(s.parts[1].value,false);plc.scan(s,.1);assert.equal(s.parts[1].value,true);s.parts[0].value=false;plc.scan(s,.1);assert.equal(s.parts[1].value,false);
});
test('CTU counts only rising edges; RES clears',()=>{
 const s={parts:[p('i','sensor'),p('reset','button')],program:[{id:'c',contacts:[{tag:'i',kind:'NO'}],coil:{tag:'C1',mode:'CTU',pv:2}},{id:'r',contacts:[{tag:'reset',kind:'NO'}],coil:{tag:'C1',mode:'RES'}}]};
 const plc=new VirtualPLC();s.parts[0].value=true;plc.scan(s,.02);plc.scan(s,.02);assert.equal(plc.counters.C1.cv,1);s.parts[0].value=false;plc.scan(s,.02);s.parts[0].value=true;plc.scan(s,.02);assert.equal(plc.counters.C1.q,true);s.parts[1].value=true;plc.scan(s,.02);assert.equal(plc.counters.C1.cv,0);
});
test('forced coil retains value until released',()=>{
 const s={parts:[p('i','sensor',true),p('q','conveyor')],program:[{id:'r',contacts:[{tag:'i',kind:'NO'}],coil:{tag:'q',mode:'OUT'}}]};const plc=new VirtualPLC();s.parts[1].forced=true;plc.scan(s,.02);assert.equal(s.parts[1].value,false);s.parts[1].forced=false;plc.scan(s,.02);assert.equal(s.parts[1].value,true);
});
test('v1 WHEN rules migrate to ladder; unknown tags rejected',()=>{
 const s={parts:[p('i','sensor'),p('q','conveyor')],rules:[{id:'old',source:'i',target:'q',inverted:false,value:true}]};assert.equal(normaliseProgram(s).length,1);assert.equal(validProgram(normaliseProgram(s),s.parts),true);assert.equal(validProgram([{id:'bad',contacts:[{tag:'unknown',kind:'NO'}],coil:{tag:'q',mode:'OUT'}}],s.parts),false);
});
test('migrated v1 scene retains its originally energised conveyor',()=>{
 const scene={parts:[p('sensor','sensor'),p('conveyor','conveyor',true),p('pusher','pusher')],rules:[{id:'old',source:'sensor',target:'pusher',inverted:false,value:true}]};
 const program=normaliseProgram(scene);assert.equal(program.some(r=>r.coil.tag==='conveyor'&&r.contacts.length===0),true);scene.program=program;
 scene.parts[1].value=false;const plc=new VirtualPLC();plc.scan(scene,.02);assert.equal(scene.parts[1].value,true);
});
