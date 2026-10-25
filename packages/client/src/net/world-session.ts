/** A Pages build can play locally or connect to a real, shared game server. */
export function gameServerUrl(value:string, pageProtocol='https:'):string {
  const url=new URL(value.trim());
  if(!['http:','https:'].includes(url.protocol)||url.username||url.password||url.search||url.hash||url.pathname!=='/')throw new Error('Enter the server address, such as https://play.example.com.');
  if(pageProtocol==='https:'&&url.protocol!=='https:')throw new Error('This page needs a secure https:// game server.');
  return url.origin;
}
const invite=new URLSearchParams(location.search).get('server');
export const HAS_SOLO=import.meta.env.VITE_SOLO==='1';
export const IS_SOLO=HAS_SOLO&&!invite;
let server='http://solo.local',serverError='';
if(!IS_SOLO)try{server=gameServerUrl(invite??(import.meta.env.VITE_SERVER_URL?.trim()||undefined)??`${location.protocol}//${location.hostname}:2567`,location.protocol);}catch(e){serverError=(e as Error).message;}
export const SERVER_URL=server;
export const SERVER_ERROR=serverError;
/** Keep the existing solo save, and isolate credentials for every online server. */
export const sessionKey=(key:string)=>IS_SOLO?key:`${key}:online:${SERVER_URL}`;
export function friendInvite(server=SERVER_URL):string {
  const url=new URL(location.href);url.search='';url.hash='';url.searchParams.set('server',gameServerUrl(server,location.protocol));return url.href;
}

/** Previous dedicated online builds used unqualified keys. Only their default server can migrate them.
 * An invite must never receive credentials from a different server or a solo world. */
export function migrateDefaultSession(storage:Pick<Storage,'getItem'|'setItem'>):void {
  if(HAS_SOLO||invite||SERVER_ERROR)return;
  const marker=sessionKey('eigen.auth-migrated');if(storage.getItem(marker))return;
  for(const key of ['eigen.device','eigen.token']){const old=storage.getItem(key);if(old&&!storage.getItem(sessionKey(key)))storage.setItem(sessionKey(key),old);}
  storage.setItem(marker,'1');
}
