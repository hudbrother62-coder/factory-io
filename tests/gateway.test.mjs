import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import { WebSocket } from 'ws';
import ModbusRTU from 'modbus-serial';

test('real Modbus TCP / WebSocket round trip and fail-safe', {timeout:15000}, async t=>{
  const child=spawn(process.execPath,['gateway/server.mjs'],{env:{...process.env,GATEWAY_PORT:'18765',MODBUS_PORT:'11502',GATEWAY_TOKEN:'integration-test-token-123456',ALLOWED_ORIGINS:'http://127.0.0.1:18765'},stdio:['ignore','pipe','pipe']});
  t.after(()=>child.kill('SIGTERM'));
  let logs='';child.stderr.on('data',d=>logs+=d);
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Gateway not ready: '+logs)),7000);child.stdout.on('data',d=>{if(String(d).includes('Factory I/O gateway:')){clearTimeout(timer);resolve();}});child.on('exit',code=>reject(Error('Gateway exited '+code+logs)));});
  const ws=new WebSocket('ws://127.0.0.1:18765',{origin:'http://127.0.0.1:18765'});t.after(()=>ws.terminate());await once(ws,'open');
  async function exchange(frame){const reply=once(ws,'message');ws.send(JSON.stringify(frame));return JSON.parse((await reply)[0].toString());}
  assert.equal((await exchange({type:'auth',token:'integration-test-token-123456'})).type,'ready');
  const inputs=Array(256).fill(false);inputs[7]=true;
  await exchange({type:'frame',running:true,inputs});
  const plc=new ModbusRTU();plc.setTimeout(1000);await plc.connectTCP('127.0.0.1',{port:11502});plc.setID(1);t.after(()=>plc.close(()=>{}));
  assert.equal((await plc.readDiscreteInputs(7,1)).data[0],true,'PLC reads simulated sensor at DI7');
  await plc.writeCoil(12,true);
  assert.equal((await exchange({type:'frame',running:true,inputs})).coils[12],true,'PLC coil drives simulator output');
  await exchange({type:'frame',running:false,inputs});
  assert.equal((await plc.readCoils(12,1)).data[0],false,'STOP clears actuator coils');
  assert.equal((await plc.readDiscreteInputs(7,1)).data[0],false,'STOP clears virtual inputs');
  await exchange({type:'frame',running:true,inputs});await plc.writeCoil(12,true);
  await delay(1600);
  assert.equal((await plc.readCoils(12,1)).data[0],false,'lost browser heartbeat clears coils');
  const denied=new WebSocket('ws://127.0.0.1:18765',{origin:'https://untrusted.example'});
  const error=await once(denied,'error');assert.match(error[0].message,/403/);
  ws.close();await once(ws,'close');
  const bad=new WebSocket('ws://127.0.0.1:18765',{origin:'http://127.0.0.1:18765'});await once(bad,'open');bad.send(JSON.stringify({type:'auth',token:'incorrect'}));assert.equal((await once(bad,'close'))[0],1008);
});
