/** Styles for the Phase 2 village UI (dialogue, quests, board, statue, overhead markers). Injected once. */
const CSS = `
.dialogue { display: grid; gap: 10px; width: min(640px, 92vw); }
.dlg-top { display: grid; grid-template-columns: auto 1fr; gap: 14px; align-items: stretch; }
.dlg-portrait { width: 96px; height: 128px; background: #17201f; border: 2px solid #786646; border-radius: 0; display: grid; place-items: end center; overflow: hidden; position: relative; }
.dlg-portrait img { width: 80px; height: 120px; object-fit: contain; image-rendering: pixelated; transition: transform .25s; }
.dlg-portrait.happy img { transform: translateY(-3px); } .dlg-portrait.sad img { filter: saturate(.6) brightness(.85); } .dlg-portrait.surprised img { transform: scale(1.05); }
.dlg-mood { position: absolute; top: 4px; right: 6px; font-size: 18px; }
.dlg-plate { display: grid; gap: 2px; align-content: start; }
.dlg-name { font-size: 1.25em; color: #fcd45a; font-weight: bold; letter-spacing: .03em; }
.dlg-title { color: var(--mute); font-size: .85em; }
.dlg-doing { color: #9fd6c8; font-size: .8em; }
.dlg-hours { font-size: .75em; } .dlg-hours.open { color: #7bc95a; } .dlg-hours.shut { color: #f07a4a; }
.dlg-event { color: #ff9ae8; font-weight: bold; letter-spacing: .05em; text-transform: uppercase; font-size: .85em; }
.dlg-box { position: relative; font-size: 1.05em; line-height: 1.5; padding: 12px 14px 22px; border: 2px solid #786646; border-radius: 0; background: #101719; min-height: 96px; white-space: pre-line; cursor: pointer; }
.dlg-box .more { position: absolute; right: 10px; bottom: 4px; color: var(--accent); animation: dlgblink 1s steps(2) infinite; font-size: .85em; }
.dlg-box .pageno { position: absolute; left: 10px; bottom: 4px; color: var(--mute); font-size: .7em; }
@keyframes dlgblink { 50% { opacity: 0; } }
.dlg-choices { display: grid; gap: 6px; }
.dlg-choices button { text-align: left; min-height: 34px; padding: 6px 12px; }
.dlg-choices button .k { color: var(--mute); margin-right: 8px; font-size: .8em; }
.dlg-choices button.ready { border-color: #fcd45a; color: #fcd45a; } .dlg-choices button.quest { border-color: #5af0d0; }
.dlg-choices button.event { border-color: #ff9ae8; } .dlg-choices button.accept { background: #1f5e33; border-color: #7bc95a; }
.dlg-actions { display: flex; flex-wrap: wrap; gap: 6px; } .dlg-actions button { min-height: 32px; padding: 4px 10px; }
.gift-note { padding: 6px 10px; border-radius: 0; background: #17201f; } .gift-note.love { color: #ff8fb8; } .gift-note.like { color: #7bc95a; } .gift-note.hate { color: #f07a4a; }
.dlg-hint { font-size: .72em; color: var(--mute); text-align: right; }


#npcfx { position: fixed; inset: 0; pointer-events: none; z-index: 3; overflow: hidden; }
.npc-mark { position: absolute; transform: translate(-50%, -100%); font: bold 20px ui-monospace, monospace; text-shadow: 0 2px #000, 0 0 6px #000; animation: markbob 1.2s ease-in-out infinite; }
.npc-mark.offer { color: #fcd45a; } .npc-mark.ready { color: #5af0d0; } .npc-mark.event { color: #ff8fb8; font-size: 16px; }
@keyframes markbob { 50% { margin-top: -4px; } }
.npc-bubble { position: absolute; transform: translate(-50%, -100%); max-width: 200px; background: #f4f0e2; color: #17201f; border: 2px solid #17201f; border-radius: 0; padding: 3px 8px; font-size: 12px; line-height: 1.3; text-align: center; white-space: normal; box-shadow: 0 2px 0 rgba(0,0,0,.35); transition: opacity .4s; }
.npc-bubble::after { content: ''; position: absolute; left: 50%; bottom: -7px; margin-left: -5px; border: 5px solid transparent; border-top-color: #17201f; }
.npc-bubble.fade { opacity: 0; }
.reduced .npc-mark { animation: none; }

.window:has(.lore) { width:min(700px,100%); }
.window:has(.lore) .win-head { display:grid; grid-template-columns:44px minmax(0,1fr) 44px; }
.window:has(.lore) .win-title { grid-column:2; grid-row:1; text-align:center; }
.window:has(.lore) .win-x { grid-column:3; grid-row:1; }
.lore { display:grid; gap:12px; width:min(100%,640px); margin-inline:auto; min-width:0; }
.lore > div { display:grid; gap:16px; min-width:0; }
.lore .small.dim { text-align:center; overflow-wrap:anywhere; }
.lore-plaque { text-align: center; padding: 16px 12px; border: 3px double #c8a35a; border-radius: 0; background: linear-gradient(#3a2a12, #22180a); color: #fcd45a; }
.lore-plaque .hail { font-size: 1.6em; letter-spacing: .09em; overflow-wrap:anywhere; font-weight: bold; text-shadow: 0 0 12px #a46aff; }
.lore-plaque .ep { margin-top: 8px; color: #e8d7a8; font-style: italic; white-space: pre-line; font-size: .9em; }
.lore-page { white-space: pre-line; line-height: 1.55; padding: 10px 12px; background: #101719; border: 2px solid #786646; border-radius: 0; min-height: 110px; }
.lore-nav { display: flex; justify-content: center; flex-wrap:wrap; align-items: center; gap: 12px; }
.lore-nav > span { flex:1 1 180px; text-align:center; }
.lore-nav button { min-height:44px; }
.lore-remark { font-size: .85em; color: var(--mute); display: flex; gap: 8px; align-items: center; }
.lore-remark img { width: 28px; height: 42px; image-rendering: pixelated; }

.board { display: grid; gap: 10px; width: min(720px, 94vw); }
.board-notice { white-space: pre-line; font-size: .8em; color: #e8d7a8; background: #2a2012; border: 2px solid #6a4f22; border-radius: 0; padding: 8px 10px; }
.board-list { display: grid; gap: 8px; }
.req { display: grid; grid-template-columns: 48px 1fr auto; gap: 10px; align-items: center; padding: 8px; background: #f1e8cf; color: #2a2318; border-radius: 0; box-shadow: 2px 3px 0 rgba(0,0,0,.4); transform: rotate(-.4deg); }
.req:nth-child(2n) { transform: rotate(.5deg); }
.req img { width: 44px; height: 66px; image-rendering: pixelated; }
.req b { color: #2a2318; } .req .small { color: #5a4f3c; } .req .rw { color: #8a5a00; font-weight: bold; }
.req.done { opacity: .55; } .req.expired { opacity: .45; }
.req button { min-height: 32px; padding: 4px 12px; }

.jq { padding: 8px 0; border-bottom: 1px solid #2c2f4a; display: grid; gap: 3px; }
.jq b { color: #fcd45a; } .jq.ready b { color: #5af0d0; } .jq .o.done { color: #7bc95a; } .jq .where { color: var(--mute); font-size: .8em; }
.jhelp h4 { margin: 10px 0 2px; color: var(--accent); } .jhelp p { margin: 0 0 4px; font-size: .88em; color: #c9cce6; }
`;

let done = false;
export function ensureP2Styles(): void {
  if (done || typeof document === 'undefined') return;
  done = true;
  const el = document.createElement('style');
  el.id = 'p2-ui-style';
  el.textContent = CSS;
  document.head.append(el);
}
