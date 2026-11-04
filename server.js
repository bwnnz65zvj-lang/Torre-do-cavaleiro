import http from 'node:http';
import {createSimulation,CRYPT_MAP} from './world.js';
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
const sim=createSimulation(CRYPT_MAP),rooms=new Map(),wss=new WebSocketServer({server,path:'/online',maxPayload:2048});
const send=(ws,data)=>{if(ws.readyState===1&&ws.bufferedAmount<262144)ws.send(JSON.stringify(data))};
const publicPlayer=p=>({id:p.id,x:p.x,z:p.z,angle:p.angle,moving:p.moving,kind:p.kind,name:p.name,map:p.map,hp:p.hp,swing:p.swing,potions:p.potions});
wss.on('connection',(ws,req)=>{
 const code=new URL(req.url,'http://localhost').searchParams.get('room')||'';
 if(!/^[a-zA-Z0-9-]{1,24}$/.test(code)){ws.close(1008,'Sala inválida');return}
 let room=rooms.get(code);
 if(!room){if(rooms.size>=30){ws.close(1013,'Servidor cheio');return}room={players:new Map(),world:sim.makeWorld()};rooms.set(code,room)}
 if(room.players.size>=4){ws.close(1008,'Sala cheia (4 jogadores)');return}
 const id=randomUUID(),p={id,x:32,z:40,map:'village',hp:100,angle:0,moving:false,kind:'paladin',name:'Aventureiro',swing:0,potions:3,mana:100,attack:30,defense:0,lastAttack:0,lastMove:Date.now(),lastTravel:0};
 room.players.set(ws,p);ws.alive=true;let messages=0,second=Date.now();
 ws.on('pong',()=>ws.alive=true);send(ws,{type:'welcome',id,version:2,player:publicPlayer(p)});
 ws.on('message',raw=>{const now=Date.now();if(now-second>1000){messages=0;second=now}if(++messages>50){ws.close(1008,'Muitas mensagens');return}try{
 const m=JSON.parse(raw);
 if(m.type==='state'){
 if(![m.x,m.z,m.angle].every(Number.isFinite))return;
 const delta=Math.hypot(m.x-p.x,m.z-p.z),elapsed=Math.min(.5,(now-p.lastMove)/1000),validMap=m.map===p.map;
 const within=p.map==='crypt'?m.x>=1&&m.x<65&&m.z>=1&&m.z<65&&sim.sight(p,m):m.x>=17&&m.x<=49&&m.z>=20&&m.z<=54;
 if(p.hp>0&&validMap&&within&&delta<=elapsed*9+.35){p.x=m.x;p.z=m.z}else if(delta>.5)send(ws,{type:'correct',player:publicPlayer(p)});
 p.lastMove=now;p.angle=m.angle;p.moving=!!m.moving&&p.hp>0;p.swing=Math.max(0,Math.min(1.2,Number(m.swing)||0));p.kind=m.kind==='archer'?'archer':'paladin';p.attack=Math.max(p.kind==='archer'?22:30,Math.min(60,Number(m.attack)||0));p.defense=Math.max(0,Math.min(8,Number(m.defense)||0));p.name=String(m.name||'Aventureiro').replace(/[<>]/g,'').slice(0,20);
 }else if(m.type==='travel'){
 if(p.hp<=0||now-p.lastTravel<1200)return;
 const gate=p.map==='village'?{x:32,z:22}:{x:10,z:50};
 if(Math.hypot(p.x-gate.x,p.z-gate.z)>4.5)return;
 p.map=p.map==='village'?'crypt':'village';Object.assign(p,p.map==='crypt'?CRYPT_MAP.start:{x:32,z:25});p.lastMove=now;p.lastTravel=now;p.moving=false;send(ws,{type:'travel',player:publicPlayer(p)});
 }else if(m.type==='attack')sim.attack(room.world,p,m,now);
 else if(m.type==='heal'&&p.hp>0&&p.hp<100&&p.potions>0){p.potions--;p.hp=Math.min(100,p.hp+55)}
 else if(m.type==='revive'&&p.hp<=0){p.hp=100;p.map='village';p.x=32;p.z=40;p.lastMove=now;send(ws,{type:'travel',player:publicPlayer(p)})}
 else if(m.type==='pickup'&&p.map==='crypt'&&p.hp>0){let d=room.world.drops.find(d=>d.id===m.id);if(d&&Math.hypot(d.x-p.x,d.z-p.z)<1.9){room.world.drops.splice(room.world.drops.indexOf(d),1);if(d.type==='potion')p.potions++;send(ws,{type:'reward',drop:d})}}
 }catch{}});
 ws.on('error',()=>{});ws.on('close',()=>{room.players.delete(ws);if(!room.players.size)rooms.delete(code)});
});
const broadcast=setInterval(()=>{for(const room of rooms.values()){
 const players=[...room.players.values()];sim.tick(room.world,players,.1);
 for(const [ws,p] of room.players)send(ws,{type:'players',players:players.map(publicPlayer),world:p.map==='crypt'?sim.snapshot(room.world):null});
}},100);
const heartbeat=setInterval(()=>{for(const ws of wss.clients){if(!ws.alive){ws.terminate();continue}ws.alive=false;ws.ping()}},30000);
server.listen(process.env.PORT||3000,'0.0.0.0',()=>console.log('Torre online pronta'));
function stop(){clearInterval(broadcast);clearInterval(heartbeat);for(const ws of wss.clients)ws.terminate();wss.close();server.close()}
process.on('SIGTERM',stop);process.on('SIGINT',stop);
