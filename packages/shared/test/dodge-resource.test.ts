import{expect,it}from'vitest';import{newPlayerSim,stepPlayer,sanitizeCmd,DASH_COOLDOWN}from'../src';
it('spam exhausts two emergency dodges and cannot buy repeated invulnerability during recharge',()=>{
 const p=newPlayerSim(0,0);let n=0;for(let i=0;i<60;i++)if(stepPlayer(p,sanitizeCmd({seq:i,dash:true,dx:1}),()=>false).dashed)n++;
 expect(n).toBe(2);expect(p.dashN).toBe(0);expect(DASH_COOLDOWN).toBe(4);
});
