import http from 'node:http';
import {createReadStream,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {WebSocketServer} from 'ws';
const assetRoot=existsSync(fileURLToPath(new URL('./public/index.html',import.meta.url)))?'./public/':'./';
const page=fileURLToPath(new URL(assetRoot+'index.html',import.meta.url));
const server=http.createServer((req,res)=>{
 if(req.url==='/health'){res.writeHead(200,{'Content-Type':'application/json'});return res.end('{"ok":true}')}
 const path=req.url.split('?')[0];
 const assets=new Set(['/knight_glb.js','/boss_glb.js','/skeleton_glb.js','/archer_glb.js','/sorcerer_glb.js']);
 const isPage=path==='/'||path==='/index.html';
 if(!isPage&&!assets.has(path)){res.writeHead(404);return res.end('Not found')}
 res.writeHead(200,{'Content-Type':isPage?'text/html; charset=utf-8':'text/javascript; charset=utf-8','Cache-Control':'no-cache'});
 createReadStream(isPage?page:fileURLToPath(new URL(assetRoot+path.slice(1),import.meta.url))).on('error',()=>res.destroy()).pipe(res);
});
const rooms=new Map(),wss=new WebSocketServer({server,path:'/online',maxPayload:1024});
const send=(ws,data)=>{if(ws.readyState===1&&ws.bufferedAmount<65536)ws.send(JSON.stringify(data))};
wss.on('connection',(ws,req)=>{
 const code=new URL(req.url,'http://localhost').searchParams.get('room')||'';
 if(!/^[a-zA-Z0-9-]{1,24}$/.test(code)){ws.close(1008,'Sala inválida');return}
 let room=rooms.get(code);
 if(!room){if(rooms.size>=100){ws.close(1013,'Servidor cheio');return}rooms.set(code,room=new Map())}
 if(room.size>=4){ws.close(1008,'Sala cheia (4 jogadores)');return}
 const id=randomUUID(),p={id,x:32,z:40,angle:0,moving:false,kind:'paladin',name:'Aventureiro'};
 room.set(ws,p);ws.alive=true;let last=0;
 ws.on('pong',()=>ws.alive=true);send(ws,{type:'welcome',id});
 ws.on('message',raw=>{const now=Date.now();if(now-last<50)return;last=now;try{
 const m=JSON.parse(raw);if(m.type!=='state'||![m.x,m.z,m.angle].every(Number.isFinite)||m.x<17||m.x>49||m.z<20||m.z>54)return;
 Object.assign(p,{x:m.x,z:m.z,angle:m.angle,moving:!!m.moving,kind:m.kind==='archer'?'archer':'paladin',name:String(m.name||'Aventureiro').replace(/[<>]/g,'').slice(0,20)});
 }catch{}});
 ws.on('error',()=>{});ws.on('close',()=>{room.delete(ws);if(!room.size)rooms.delete(code)});
});
const broadcast=setInterval(()=>{for(const room of rooms.values()){const data={type:'players',players:[...room.values()]};for(const ws of room.keys())send(ws,data)}},100);
const heartbeat=setInterval(()=>{for(const ws of wss.clients){if(!ws.alive){ws.terminate();continue}ws.alive=false;ws.ping()}},30000);
server.listen(process.env.PORT||3000,'0.0.0.0',()=>console.log('Torre online pronta'));
function stop(){clearInterval(broadcast);clearInterval(heartbeat);for(const ws of wss.clients)ws.terminate();wss.close();server.close()}
process.on('SIGTERM',stop);process.on('SIGINT',stop);
