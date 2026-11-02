#!/usr/bin/env node
/* For the daily release workflow: prints which game (if any) goes live today, Bangladesh time.
 *   date=2026-11-03
 *   title=2048          (empty when nothing is scheduled for today) */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const today = process.env.MG_TODAY || new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dhaka', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const due = fs.readdirSync(path.join(ROOT, 'games'))
  .map(d => { try { return JSON.parse(fs.readFileSync(path.join(ROOT, 'games', d, 'meta.json'), 'utf8')); } catch { return null; } })
  .filter(g => g && g.added === today);
console.log('date=' + today);
console.log('title=' + due.map(g => g.title).join(', '));
