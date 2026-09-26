import http from 'node:http';
import https from 'node:https';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { WebSocketServer } from 'ws';
import ModbusRTU from 'modbus-serial';

const port=Number(process.env.GATEWAY_PORT||8765),mbPort=Number(process.env.MODBUS_PORT||1502);
const token=process.env.GATEWAY_TOKEN||randomBytes(32).toString('hex');
if(token.length<16)throw Error('GATEWAY_TOKEN must contain at least 16 characters');
const root=resolve(fileURLToPath(new URL('../dist/',import.meta.url)));
const tls=process.env.GATEWAY_CERT&&process.env.GATEWAY_KEY;
const origins=new Set((process.env.ALLOWED_ORIGINS||`http://127.0.0.1:${port},http://localhost:${port},https://factory-io.vercel.app`).split(','));
const inputs=Array(256).fill(false),coils=Array(256).fill(false);
let owner=null,lastFrame=0,running=false,lastPlcWrite=0;
const clear=()=>{inputs.fill(false);coils.fill(false);running=false;lastPlcWrite=0;};
const active=()=>owner&&Date.now()-lastFrame<1200;
const address=a=>{if(!Number.isInteger(a)||a<0||a>255)throw Object.assign(new Error('Illegal data address'),{modbusErrorCode:2});};
const vector={
  getDiscreteInput(a){address(a);return Boolean(active()&&running&&inputs[a]);},
  getCoil(a){address(a);return Boolean(active()&&running&&coils[a]);},
  setCoil(a,v){address(a);if(!active()||!running)return;coils[a]=Boolean(v);lastPlcWrite=Date.now();},
  getInputRegister(a){address(a);if(a===0)return active()&&running?1:0;return 0;},
};
const modbus=new ModbusRTU.ServerTCP(vector,{host:process.env.MODBUS_HOST||'127.0.0.1',port:mbPort,unitID:1});
modbus.on('serverError',e=>{console.error('Modbus listener failed:',e.message);process.exitCode=1;server.close();});
modbus.on('socketError',e=>console.error('Modbus socket:',e.message));
const handler=(req,res)=>{
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);return res.end();}
  let pathname;try{pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);}catch{res.writeHead(400);return res.end();}
  if(pathname==='/health'){res.setHeader('Content-Type','application/json');return res.end(JSON.stringify({service:'factory-io-gateway',version:1}));}
  const path=resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
  if(!path.startsWith(root+sep)||!existsSync(path)){res.writeHead(404);return res.end('Build the workspace first: npm run build');}
  try{const data=readFileSync(path);res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.json':'application/json'})[extname(path)]||'application/octet-stream');res.setHeader('X-Content-Type-Options','nosniff');res.end(req.method==='HEAD'?undefined:data);}catch{res.writeHead(404);res.end();}
};
const server=tls?https.createServer({cert:readFileSync(process.env.GATEWAY_CERT),key:readFileSync(process.env.GATEWAY_KEY)},handler):http.createServer(handler);
const wss=new WebSocketServer({noServer:true,maxPayload:8192});
server.on('upgrade',(req,socket,head)=>{if(!origins.has(req.headers.origin)){socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');socket.destroy();return;}wss.handleUpgrade(req,socket,head,ws=>wss.emit('connection',ws,req));});
wss.on('connection',ws=>{
  let authenticated=false;const timer=setTimeout(()=>{if(!authenticated)ws.close(1008,'Authentication required');},5000);
  ws.on('message',raw=>{let m;try{m=JSON.parse(raw.toString());}catch{return ws.close(1008,'Invalid JSON');}
    if(!authenticated){const supplied=Buffer.from(typeof m.token==='string'?m.token:''),expected=Buffer.from(token);if(m.type!=='auth'||supplied.length!==expected.length||!timingSafeEqual(supplied,expected)||owner){ws.close(1008,'Invalid token or workspace already connected');return;}authenticated=true;clearTimeout(timer);owner=ws;clear();lastFrame=Date.now();ws.send(JSON.stringify({type:'ready'}));return;}
    if(m.type!=='frame'||!Array.isArray(m.inputs)||m.inputs.length!==256||!m.inputs.every(v=>typeof v==='boolean')||typeof m.running!=='boolean'){ws.close(1008,'Invalid frame');return;}
    lastFrame=Date.now();running=m.running;if(!running){clear();}else for(let i=0;i<256;i++)inputs[i]=m.inputs[i];
    if(lastPlcWrite&&Date.now()-lastPlcWrite>1500)coils.fill(false);
    ws.send(JSON.stringify({type:'state',coils}));
  });
  ws.on('close',()=>{clearTimeout(timer);if(owner===ws){owner=null;clear();}});
  ws.on('error',()=>{});
});
const watchdog=setInterval(()=>{if(!active())clear();},200);
server.listen(port,process.env.GATEWAY_HOST||'127.0.0.1',()=>{
  console.log(`Factory I/O gateway: ${tls?'https':'http'}://127.0.0.1:${port}`);
  console.log(`Modbus TCP: ${process.env.MODBUS_HOST||'127.0.0.1'}:${mbPort}, unit 1`);
  if(!process.env.GATEWAY_TOKEN)console.log(`Session token: ${token}`);
  console.log('PLC must refresh actuator coils at least every 1 second. FC02 = sensors; FC05/15 = simulated actuators.');
});
function shutdown(){clearInterval(watchdog);for(const ws of wss.clients)ws.terminate();wss.close();server.close();modbus.close(()=>process.exit(0));setTimeout(()=>process.exit(0),500).unref();}
process.on('SIGTERM',shutdown);process.on('SIGINT',shutdown);
