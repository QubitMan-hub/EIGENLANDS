import {afterEach,expect,it,vi} from 'vitest';
import {loadSettings,saveSettings} from '../src/ui/ui';
afterEach(()=>vi.unstubAllGlobals());
it('defaults old/malformed settings to keyboard and saves a validated mouse preference',()=>{
 let raw='{}';vi.stubGlobal('matchMedia',()=>({matches:false}));vi.stubGlobal('localStorage',{getItem:()=>raw,setItem:(_key:string,value:string)=>{raw=value;}});
 expect(loadSettings().movementMode).toBe('keyboard');raw=JSON.stringify({movementMode:'auto',muted:true});expect(loadSettings().movementMode).toBe('keyboard');expect(loadSettings().muted).toBe(true);
 const s=loadSettings();s.movementMode='mouse';saveSettings(s);expect(loadSettings().movementMode).toBe('mouse');
 raw='broken';expect(loadSettings().movementMode).toBe('keyboard');
});
