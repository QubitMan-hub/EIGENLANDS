import {afterEach,expect,it,vi} from 'vitest';
afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();vi.resetModules();});
async function session(url:string,solo=true){vi.stubGlobal('location',new URL(url));vi.stubEnv('VITE_SOLO',solo?'1':'0');return import('../src/net/world-session');}
it('keeps old solo credentials but isolates each online server and copies a clean invite',async()=>{
 let s=await session('https://game.example/EIGENLANDS/?dev=1');expect(s.IS_SOLO).toBe(true);expect(s.sessionKey('eigen.token')).toBe('eigen.token');
 vi.resetModules();s=await session('https://game.example/EIGENLANDS/?server=https%3A%2F%2Ffriends.example&dev=1');expect(s.IS_SOLO).toBe(false);expect(s.SERVER_URL).toBe('https://friends.example');expect(s.sessionKey('eigen.token')).toContain('online:https://friends.example');expect(s.friendInvite()).toBe('https://game.example/EIGENLANDS/?server=https%3A%2F%2Ffriends.example');
});
it('rejects insecure mixed content, credentials, fake schemes and invalid invites without crashing boot',async()=>{
 const s=await session('https://game.example/?server=javascript%3Aalert(1)');expect(s.SERVER_ERROR).not.toBe('');
 for(const url of ['http://friends.example','https://user:pass@friends.example','https://friends.example/api','file:///tmp/server'])expect(()=>s.gameServerUrl(url)).toThrow();
 expect(s.gameServerUrl('http://localhost:2567','http:')).toBe('http://localhost:2567');
});

it('migrates the old dedicated online login only for its default server, once',async()=>{
 const values=new Map([['eigen.token','old-online-token'],['eigen.device','old-device']]);const storage={getItem:(k:string)=>values.get(k)??null,setItem:(k:string,v:string)=>{values.set(k,v);}};
 let s=await session('http://localhost:5241/',false);s.migrateDefaultSession(storage);expect(values.get(s.sessionKey('eigen.token'))).toBe('old-online-token');
 values.delete(s.sessionKey('eigen.token'));s.migrateDefaultSession(storage);expect(values.has(s.sessionKey('eigen.token'))).toBe(false);
 vi.resetModules();s=await session('http://localhost:5241/?server=http%3A%2F%2Fother.test',false);s.migrateDefaultSession(storage);expect(values.has(s.sessionKey('eigen.token'))).toBe(false);
});
