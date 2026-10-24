import {afterEach,expect,it,vi} from 'vitest';
import {prepareWorldChunk,hasPreparedWorldChunk} from '@eigenlands/shared';
import {WorldPreparer} from '../src/game/world-preparer';
afterEach(()=>vi.unstubAllGlobals());
it('adopts worker output and unblocks initial loading',async()=>{
 let worker:any;class FakeWorker{onmessage:any;onerror:any;sent:any[]=[];constructor(){worker=this;}postMessage(m:any){this.sent.push(m);}terminate(){}}
 vi.stubGlobal('Worker',FakeWorker);const p=new WorldPreparer(),done=p.neighborhood(91417,4,-5,0),req=worker.sent[0];
 worker.onmessage({data:{id:req.id,chunk:prepareWorldChunk(req.seed,req.cx,req.cy)}});await done;
 expect(hasPreparedWorldChunk(91417,4,-5)).toBe(true);expect(worker.sent).toHaveLength(1);
});
it('cancels stale queued chunks and falls back without hanging when a worker fails',async()=>{
 let worker:any;class FakeWorker{onmessage:any;onerror:any;sent:any[]=[];constructor(){worker=this;}postMessage(m:any){this.sent.push(m);}terminate(){}}
 vi.stubGlobal('Worker',FakeWorker);const p=new WorldPreparer(),old=p.neighborhood(91418,0,0,1),next=p.neighborhood(91418,99,99,0);
 worker.onerror({preventDefault(){}});await Promise.all([old,next]);expect(worker.sent).toHaveLength(1);
 await p.neighborhood(91418,100,100,1);expect(worker.sent).toHaveLength(1);
});
