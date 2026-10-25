/** Run against an owned test server: npm run loadtest -- 21 60 http://localhost:2567.
 * Measures live shared-room movement/combat, ACK delivery, RTT and simulation budget.
 * Does not measure browser rendering or prove performance on a different host/region.
 */
import {writeFileSync} from 'node:fs';
import {Client, type Room} from 'colyseus.js';
import {JOIN_ROOM, MSG, TICK_MS, decodeAck} from '@eigenlands/shared';

const bots=Number(process.argv[2]??21),seconds=Number(process.argv[3]??60);
const endpoint=new URL(process.argv[4]??'http://localhost:2567');
if(!Number.isInteger(bots)||bots<1||bots>500||!Number.isFinite(seconds)||seconds<5||seconds>600||!['http:','https:'].includes(endpoint.protocol)||endpoint.username||endpoint.password)throw new Error('Use 1–500 bots, 5–600 seconds, and an http(s) server URL without credentials.');
const url=endpoint.origin,sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms));
const rooms:Room[]=[];const timers:ReturnType<typeof setInterval>[]=[];
const counts:number[]=[],moved=new Set<number>(),starts=new Map<number,{x:number;y:number}>(),rtts:number[]=[];
let failed=0,disconnected=0,measuring=false,ackBytes=0;
const metrics=async()=>{const r=await fetch(`${url}/metrics`,{signal:AbortSignal.timeout(5000)});if(!r.ok)throw new Error(`Metrics HTTP ${r.status}; run through the VM's loopback backend address, not the public proxy.`);return await r.json() as {tickMsAvg:number;tickMsMax:number;overBudget:number;ticks:number;rssMb:number;players:number;enemies:number};};
async function bot(i:number){
 try {
  const response=await fetch(`${url}/api/auth/guest`,{method:'POST',headers:{'content-type':'application/json'},body:'{}',signal:AbortSignal.timeout(10000)});
  if(!response.ok)throw new Error(`Guest login HTTP ${response.status}`);
  const guest=await response.json() as {token:string};
  const room=await new Client(url.replace(/^http/,'ws')).joinOrCreate(JOIN_ROOM,{token:guest.token,name:`load${i}`});rooms.push(room);counts[i]=0;
  room.onMessage('*',()=>{});
  room.onMessage(MSG.ACK,(data:Uint8Array)=>{
   const p=decodeAck(data).sim,start=starts.get(i);if(!start)starts.set(i,{x:p.x,y:p.y});else if(Math.hypot(p.x-start.x,p.y-start.y)>.5)moved.add(i);
   if(measuring){counts[i]++;ackBytes+=data.byteLength;}
  });
  room.onMessage(MSG.PONG,(data:{t:number})=>{if(measuring&&typeof data.t==='number')rtts.push(performance.now()-data.t);});
  room.onLeave(()=>{if(measuring)disconnected++;});
  room.onError(()=>{if(measuring)failed++;});
  let seq=0,t=0,dx=1,dy=0;
  const timer=setInterval(()=>{
   if(t++%20===0){const angle=Math.random()*Math.PI*2;dx=Math.cos(angle);dy=Math.sin(angle);}
   room.send(MSG.INPUT,{cmds:[{seq:++seq,dx,dy,dash:t%37===0,attack:t%5===0,hold:false,skill:t%23===0,aimX:dx,aimY:dy,viewTick:0}]});
   if(t%40===0)room.send(MSG.PING,{t:performance.now()});
  },TICK_MS);timers.push(timer);room.onLeave(()=>clearInterval(timer));
 }catch(error){failed++;console.error(`Bot ${i}: ${(error as Error).message}`);}
}
try {
 await metrics();
 // Pace authentication so the test itself does not exhaust a shared-IP login bucket.
 for(let i=0;i<bots;i++){await bot(i);await sleep(150);}
 console.log(`Joined ${rooms.length}/${bots} players; warming up for 5s.`);await sleep(5000);
 const baseline=await metrics(),samples:Array<Awaited<ReturnType<typeof metrics>>>=[];measuring=true;
 const started=Date.now();
 while(Date.now()-started<seconds*1000){await sleep(Math.min(2000,seconds*1000-(Date.now()-started)));const m=await metrics();samples.push(m);console.log(`players ${m.players}, enemies ${m.enemies}, tick avg ${m.tickMsAvg.toFixed(2)}ms, peak ${m.tickMsMax.toFixed(1)}ms, RSS ${m.rssMb}MB`);}
 measuring=false;const last=samples.at(-1)!,sorted=[...rtts].sort((a,b)=>a-b),percentile=(p:number)=>sorted.length?sorted[Math.min(sorted.length-1,Math.floor(sorted.length*p))]!:null;
 const report={requested:bots,joined:rooms.length,failed,unexpectedDisconnects:disconnected,durationSeconds:(Date.now()-started)/1000,movedClients:moved.size,minClientAcks:Math.min(...counts),rttP50Ms:percentile(.5),rttP95Ms:percentile(.95),maxSampledTickAverageMs:Math.max(...samples.map(s=>s.tickMsAvg)),overBudgetTicks:last.overBudget-baseline.overBudget,observedTicks:last.ticks-baseline.ticks,maxSampledRssMb:Math.max(...samples.map(s=>s.rssMb)),ackPayloadBytesPerSecond:ackBytes/((Date.now()-started)/1000),passed:false};
 report.passed=report.joined===bots&&failed===0&&disconnected===0&&moved.size===bots&&report.minClientAcks>=seconds*5&&report.observedTicks>0&&report.maxSampledTickAverageMs<25&&report.overBudgetTicks===0&&report.rttP95Ms!==null&&report.rttP95Ms<250;
 console.log(JSON.stringify(report,null,2));
 if(process.env.REPORT_FILE)writeFileSync(process.env.REPORT_FILE,JSON.stringify(report,null,2)+'\n');
 if(!report.passed)process.exitCode=1;
}catch(error){console.error((error as Error).message);process.exitCode=1;}
finally {measuring=false;timers.forEach(clearInterval);await Promise.allSettled(rooms.map(r=>r.leave()));}
