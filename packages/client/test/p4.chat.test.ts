import { describe, expect, it } from 'vitest';
import type { ChatMsg } from '@eigenlands/shared';
import { ChatModel, parseCommand, splitName } from '../src/features/social/model';

const ctx = { ch: 'local' as const, known: ['Big Bob', 'Bo', 'Alice'] };
const msg = (o: Partial<ChatMsg>): ChatMsg => ({ ch: 'local', from: 'Ann', fromId: 'id-ann', text: 'hi', t: 1, ...o });

class MemStore { m = new Map<string, string>(); getItem(k: string) { return this.m.get(k) ?? null; } setItem(k: string, v: string) { this.m.set(k, v); } }

describe('slash commands', () => {
  it('plain lines go to the current channel; // escapes a slash', () => {
    expect(parseCommand('hello there', ctx)).toEqual({ k: 'say', ch: 'local', text: 'hello there' });
    expect(parseCommand('  ', ctx)).toEqual({ k: 'none' });
    expect(parseCommand('//shrug', ctx)).toEqual({ k: 'say', ch: 'local', text: '/shrug' });
    expect(parseCommand('hey', { ch: 'party' })).toEqual({ k: 'say', ch: 'party', text: 'hey' });
    expect(parseCommand('hey', { ch: 'whisper', whisperTo: 'Alice' })).toEqual({ k: 'say', ch: 'whisper', text: 'hey', to: 'Alice' });
    expect(parseCommand('hey', { ch: 'whisper' }).k).toBe('error');
  });

  it('whisper, reply and channel switches', () => {
    expect(parseCommand('/w alice how are you', ctx)).toEqual({ k: 'say', ch: 'whisper', to: 'alice', text: 'how are you' });
    expect(parseCommand('/tell Big Bob hi there', ctx)).toEqual({ k: 'say', ch: 'whisper', to: 'Big Bob', text: 'hi there' });
    expect(parseCommand('/w "Some One" yo', ctx)).toEqual({ k: 'say', ch: 'whisper', to: 'Some One', text: 'yo' });
    expect(parseCommand('/w Alice', ctx).k).toBe('error');
    expect(parseCommand('/r thanks', ctx)).toEqual({ k: 'error', text: 'Nobody has whispered you yet.' });
    expect(parseCommand('/r thanks', { ...ctx, lastWhisper: 'Bo' })).toEqual({ k: 'say', ch: 'whisper', to: 'Bo', text: 'thanks' });
    expect(parseCommand('/p ready?', ctx)).toEqual({ k: 'say', ch: 'party', text: 'ready?' });
    expect(parseCommand('/g hello all', ctx)).toEqual({ k: 'say', ch: 'global', text: 'hello all' });
    expect(parseCommand('/s hi', ctx)).toEqual({ k: 'say', ch: 'local', text: 'hi' });
    expect(parseCommand('/P', ctx)).toEqual({ k: 'channel', ch: 'party' });
    expect(parseCommand('/l', ctx)).toEqual({ k: 'channel', ch: 'local' });
  });

  it('social commands take (possibly multi-word) names', () => {
    expect(parseCommand('/invite Big Bob', ctx)).toEqual({ k: 'invite', name: 'Big Bob' });
    expect(parseCommand('/trade bo', ctx)).toEqual({ k: 'trade', name: 'bo' });
    expect(parseCommand('/block Alice', ctx)).toEqual({ k: 'block', name: 'Alice' });
    expect(parseCommand('/unblock Alice', ctx)).toEqual({ k: 'unblock', name: 'Alice' });
    expect(parseCommand('/mute Bo', ctx)).toEqual({ k: 'mute', name: 'Bo' });
    expect(parseCommand('/kick Bo', ctx)).toEqual({ k: 'kick', name: 'Bo' });
    expect(parseCommand('/promote Big Bob', ctx)).toEqual({ k: 'promote', name: 'Big Bob' });
    expect(parseCommand('/invite', ctx)).toEqual({ k: 'error', text: 'Usage: /invite name' });
    expect(parseCommand('/leave', ctx)).toEqual({ k: 'leave' });
    expect(parseCommand('/report Big Bob spamming the market', ctx)).toEqual({ k: 'report', name: 'Big Bob', reason: 'spamming the market' });
    expect(parseCommand('/report Bo', ctx)).toEqual({ k: 'report', name: 'Bo', reason: 'no reason given' });
  });

  it('emotes, help and unknown commands', () => {
    expect(parseCommand('/wave', ctx)).toEqual({ k: 'emote', e: 'wave' });
    expect(parseCommand('/emote Dance', ctx)).toEqual({ k: 'emote', e: 'dance' });
    expect(parseCommand('/emote explode', ctx)).toEqual({ k: 'help', topic: 'emotes' });
    expect(parseCommand('/help', ctx)).toEqual({ k: 'help' });
    expect(parseCommand('/clear', ctx)).toEqual({ k: 'clear' });
    expect(parseCommand('/frobnicate', ctx).k).toBe('error');
  });

  it('splitName prefers the longest known name and only at a word boundary', () => {
    expect(splitName('Bob hi', ['Bo'])).toEqual(['Bob', 'hi']);
    expect(splitName('big bob hi', ['Big Bob', 'Big'])).toEqual(['big bob', 'hi']);
    expect(splitName('', [])).toEqual(['', '']);
  });
});

describe('chat model', () => {
  it('filters by tab and counts unread per tab', () => {
    const m = new ChatModel();
    m.setTab('local');
    m.add(msg({ ch: 'local', text: 'a', t: 1 }), 'Me');
    m.add(msg({ ch: 'party', text: 'b', t: 2 }), 'Me');
    m.add(msg({ ch: 'global', text: 'c', t: 3 }), 'Me');
    m.add({ ch: 'system', from: '', fromId: '', text: 'sys', t: 4 }, 'Me');
    expect(m.visible().map((x) => x.text)).toEqual(['a', 'sys']);
    expect(m.unread.party).toBe(1);
    expect(m.unread.global).toBe(1);
    expect(m.unread.local).toBe(0);
    expect(m.unread.all).toBe(3);
    m.setTab('party');
    expect(m.unread.party).toBe(0);
    expect(m.visible('all').length).toBe(4);
    // own lines never count as unread
    m.add(msg({ ch: 'global', from: 'Me', text: 'mine', t: 5 }), 'Me');
    expect(m.unread.global).toBe(1);
  });

  it('drops duplicate replays and caps the list', () => {
    const m = new ChatModel(null, 5);
    expect(m.add(msg({ t: 1 }))).toBe(true);
    expect(m.add(msg({ t: 1 }))).toBe(false);
    for (let i = 2; i < 20; i++) m.add(msg({ t: i, text: `l${i}` }));
    expect(m.lines.length).toBe(5);
    expect(m.lines[4]!.text).toBe('l19');
  });

  it('remembers the last whisperer for /r', () => {
    const m = new ChatModel();
    m.add(msg({ ch: 'whisper', from: 'Zed', fromId: 'z', to: 'Me', text: 'yo', t: 9 }), 'Me');
    m.add(msg({ ch: 'whisper', from: 'Me', fromId: 'me', to: 'Kim', text: 'hi', t: 10 }), 'Me');
    expect(m.lastWhisper).toBe('Zed');
  });

  it('blocked and muted players are hidden, and the lists persist', () => {
    const store = new MemStore();
    const m = new ChatModel(store);
    m.block('Ann', 'id-ann');
    expect(m.add(msg({ t: 1 }))).toBe(false);
    expect(m.add(msg({ t: 2, from: 'Ann2', fromId: 'id-ann' }))).toBe(false); // renamed, same account
    m.mute('Kim');
    expect(m.add(msg({ t: 3, from: 'kim', fromId: 'k' }))).toBe(false);
    const again = new ChatModel(store);
    expect(again.isBlocked('ANN')).toBe(true);
    expect(again.isMuted('Kim')).toBe(true);
    expect(again.unblock('ann', 'id-ann')).toBe(true);
    expect(again.add(msg({ t: 4 }))).toBe(true);
    expect(new ChatModel(store).isBlocked('Ann')).toBe(false);
    // corrupt storage falls back to empty lists
    store.setItem('eigen.blocked', '{nope');
    expect(new ChatModel(store).blocked.size).toBe(0);
  });

  it('history: up walks back, down returns to the draft', () => {
    const m = new ChatModel();
    m.pushHistory('one'); m.pushHistory('two'); m.pushHistory('two');
    expect(m.prev('dra')).toBe('two');
    expect(m.prev('two')).toBe('one');
    expect(m.prev('one')).toBe('one');
    expect(m.next()).toBe('two');
    expect(m.next()).toBe('dra');
    expect(m.next()).toBe('dra');
  });
});
