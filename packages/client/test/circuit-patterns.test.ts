import { expect, it } from 'vitest';
import { emptyBoard, emptyGateCounts, boardPreview, type Board } from '@eigenlands/shared';
import { applyPattern } from '../src/features/circuit/patterns';
const rules=()=>({qubits:2,gates:{...emptyGateCounts(),h:3,x:2,z:1,cx:1,m:1},runes:2,allowed:['split_shot','echo_step'] as const});
const board=()=>{const b=emptyBoard();b.abilities[0]='split_shot';b.abilities[1]='echo_step';return b;};
const apply=(b:Board,id:string,q=0)=>applyPattern(b,id,q,{...rules(),allowed:[...rules().allowed]});
it('replaces one line without mutating the source or its ability/runes/unrelated gates',()=>{
 const b=board();b.lines[0]![5]={g:'x'};b.lines[1]![7]={g:'h'};b.runes[0]=1;const old=JSON.stringify(b);
 const r=apply(b,'split');expect(r.ok).toBe(true);if(!r.ok)return;
 expect(r.board.lines[0]!.filter(Boolean)).toEqual([{g:'h'}]);expect(r.board.lines[1]).toEqual(b.lines[1]);expect(r.board.abilities).toEqual(b.abilities);expect(r.board.runes).toEqual(b.runes);expect(JSON.stringify(b)).toBe(old);
});
it('reuses gates removed from the selected line but cannot borrow occupied tokens elsewhere',()=>{
 const b=board();b.lines[0]![0]={g:'h'};const r=applyPattern(b,'split',0,{...rules(),gates:{...emptyGateCounts(),h:1},allowed:[...rules().allowed]});expect(r.ok).toBe(true);
 b.lines[1]![0]={g:'h'};b.lines[0]![0]=null;expect(applyPattern(b,'split',0,{...rules(),gates:{...emptyGateCounts(),h:1},allowed:[...rules().allowed]}).ok).toBe(false);
});
it('uses the real evaluator for split, flip, interference and pending lock outcomes',()=>{
 for(const [id,p] of [['split',.5],['flip',1],['interference',1]] as const){const r=apply(board(),id);expect(r.ok).toBe(true);if(r.ok)expect(boardPreview(r.board,2,null).lines[0]!.pBIdeal).toBeCloseTo(p);}
 const r=apply(board(),'lock');expect(r.ok).toBe(true);if(r.ok)expect(boardPreview(r.board,2,null).lines[0]!.locked).toBe('pending');
});
it('removes an incoming link as manual editing does and rejects a blocked new link destination',()=>{
 const b=board();b.lines[1]![4]={g:'cx',t:0};const r=apply(b,'split');expect(r.ok).toBe(true);if(r.ok)expect(r.board.lines[1]![4]).toBeNull();
 b.lines[1]![1]={g:'x'};expect(apply(b,'link').ok).toBe(false);
 const linked=apply(board(),'link');expect(linked.ok).toBe(true);if(linked.ok)expect(boardPreview(linked.board,2,null).lines[0]!.fires).toEqual([1]);
});
it('refuses unknown patterns, locked/support orbs, missing abilities and invalid resulting boards',()=>{
 expect(apply(board(),'missing').ok).toBe(false);expect(apply(board(),'split',2).ok).toBe(false);expect(apply(board(),'split',NaN).ok).toBe(false);
 const b=board();b.abilities[0]=null;expect(apply(b,'split').ok).toBe(false);
 expect(applyPattern(board(),'link',0,{...rules(),qubits:1,allowed:[...rules().allowed]}).ok).toBe(false);
 b.abilities[0]='mend';expect(apply(b,'split').ok).toBe(false);
});
