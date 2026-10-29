// 用法：node tools/test/suite.js [放 4500.html／essay.html／units.html 的資料夾，預設 sources]
// 需要 playwright（NODE_PATH=$(npm root -g)）。每次改完三個 app 都要跑，全部 PASS 才發布。
// 三個 app 全模式自動測試
const { chromium } = require('playwright');
const fails = [];
const counts = {};
const ok = (cond, msg) => { const k = msg.split(/[：:\s]/)[0]; counts[k] = (counts[k] || 0) + 1; if (!cond) fails.push(msg); };
let browser;
async function page(f, w = 420) {
  const ctx = await browser.newContext({ viewport: { width: w, height: 900 } });
  const p = await ctx.newPage();
  p.errs = [];
  p.on('pageerror', e => p.errs.push(e.message));
  p.on('dialog', d => d.accept());
  await p.addInitScript(() => { window.__fl = () => { const h = window.__essay || window.__units; return h ? h.famLog : famLog; }; });
  await p.route(/fonts\.(googleapis|gstatic)/, r => r.abort());
  await p.goto('file://' + require('path').resolve(process.argv[2] || 'sources') + '/' + f + '.html');
  await p.waitForTimeout(400);
  return p;
}
const lastLog = p => p.evaluate(() => __fl()[__fl().length - 1]);
const logLen = p => p.evaluate(() => __fl().length);

// ---------------- 4500 ----------------
async function t4500() {
  const p = await page('4500');
  await p.click('#studyToggle');
  // 單題四選一：交替答對答錯
  await p.click('[data-mode="single"]');
  for (let round = 0; round < 3; round++) {
    await p.click('#startBtn');
    const n = await p.evaluate(() => sg.qs.length);
    let right = 0;
    for (let i = 0; i < n; i++) {
      const want = (i + round) % 2 === 0;
      const k = await p.evaluate(want => { const it = sg.qs[sg.i]; const c = it.opts.indexOf(it.q.w); return want ? c : (c + 1) % it.opts.length; }, want);
      ok(k >= 0, '4500 single: 正解不在選項裡');
      const before = await logLen(p);
      await p.click(`[data-k="${k}"]`);
      const st = await p.evaluate(k => ({ clickedRight: document.querySelector(`[data-k="${k}"]`).classList.contains('right'), anyWrong: !!document.querySelector('.opt.wrong'), rights: document.querySelectorAll('.opt.right').length }), k);
      ok(st.rights === 1, '4500 single: 正確選項標示數量 ≠ 1');
      ok(want ? (st.clickedRight && !st.anyWrong) : (!st.clickedRight && st.anyWrong), `4500 single: 第 ${i + 1} 題判定錯誤 (want=${want})`);
      const L = await lastLog(p);
      ok((await logLen(p)) === before + 1 && L[5] === (want ? 1 : 0), '4500 single: 紀錄的對錯不一致');
      if (want) right++;
      await p.click('#next');
    }
    const score = await p.locator('.score').innerText();
    ok(score.replace(/\s/g, '').startsWith(right + '/' + n), `4500 single: 結果頁分數 ${score} 應為 ${right}/${n}`);
    ok((await p.locator('.wrong-list li').count()) === n - right, '4500 single: 答錯清單數量不對');
    if (n - right > 0) {
      await p.click('#retryWrong');
      const m = await p.evaluate(() => sg.qs.length);
      for (let i = 0; i < m; i++) {
        const k = await p.evaluate(() => { const it = sg.qs[sg.i]; return it.opts.indexOf(it.q.w); });
        ok(k >= 0, '4500 retry: 正解不在選項裡');
        await p.click(`[data-k="${k}"]`);
        ok(!(await p.locator('.opt.wrong').count()), '4500 retry: 選正解卻被判錯');
        await p.click('#next');
      }
      const s2 = await p.locator('.score').innerText();
      ok(s2.replace(/\s/g, '').startsWith(m + '/' + m), '4500 retry: 結果頁不是全對 ' + s2);
    }
    await p.click('#toSetup');
  }
  // 文意選填：全部填對，然後互換兩格
  await p.click('[data-mode="cloze"]');
  for (const swap of [false, true]) {
    await p.click('#startBtn');
    const map = await p.evaluate(() => cz.qs.map(q => cz.opts.findIndex(o => o.a.toLowerCase() === q.a.toLowerCase())));
    ok(map.every(x => x >= 0), '文意選填：有題目的答案不在選項裡');
    if (swap) { const t = map[0]; map[0] = map[1]; map[1] = t; }
    for (let i = 0; i < map.length; i++) { await p.click(`[data-blank="${i}"]`); await p.click(`[data-opt="${map[i]}"]`); }
    const before = await logLen(p);
    await p.click('#submit');
    const score = await p.locator('.score').innerText();
    const exp = swap ? map.length - 2 : map.length;
    ok(score.replace(/\s/g, '').startsWith(exp + '/' + map.length), `文意選填：分數 ${score} 應為 ${exp}/${map.length}`);
    ok((await logLen(p)) === before + map.length, '文意選填：紀錄筆數不對');
    const okCnt = await p.evaluate(n => __fl().slice(-n).filter(r => r[5]).length, map.length);
    ok(okCnt === exp, '文意選填：紀錄的答對數不對');
    await p.click('#toSetup');
  }
  // 單字卡：記得、不熟、上一張
  await p.click('[data-mode="flash"]');
  await p.click('#startBtn');
  const before = await logLen(p);
  await p.click('#fcCard'); await p.click('#rGood');
  await p.click('#fcCard'); await p.click('#rBad');
  ok((await logLen(p)) === before + 2, '單字卡：紀錄筆數不對');
  await p.click('#undoBtn');
  ok((await logLen(p)) === before + 1, '單字卡：上一張沒有拿掉紀錄');
  await p.click('#rGood');
  ok((await logLen(p)) === before + 2, '單字卡：重選後紀錄筆數不對');
  ok(await p.evaluate(() => __fl().slice(-2).every(r => r[2] === 'flash')), '單字卡：紀錄的模式不是 flash');
  await p.click('#fcEnd');
  ok((await p.locator('.score').innerText()).includes('2'), '單字卡：結果頁');
  await p.click('#toSetup');
  // 分析頁與單字表標籤
  await p.click('#faOpen'); await p.waitForTimeout(100);
  ok(await p.locator('.fa-tiles').count(), '4500 分析頁打不開');
  await p.click('#faClose');
  await qz(p, '4500');
  ok(!p.errs.length, '4500 頁面錯誤：' + p.errs.join(' | '));
}

// ---------------- Quizlet 模組（三個 app 共用） ----------------
async function qz(p, name) {
  await p.click('#qzOpen'); await p.waitForTimeout(100);
  await p.click('#qzAll').catch(() => {});
  // 單字卡
  await p.click('#qzFlash'); await p.waitForTimeout(80);
  for (let i = 0; i < 3; i++) { await p.click('#qzCard').catch(() => {}); await p.click(i % 2 ? '#qzStill' : '#qzKnow'); }
  if (await p.locator('#qzUndo').count()) await p.click('#qzUndo');
  await p.click('#qzBack').catch(() => {}); await p.click('#qzHome').catch(() => {});
  if (!(await p.locator('#qzLearn').count())) { await p.click('#qzClose').catch(() => {}); await p.click('#qzOpen'); }
  // 學習：選擇題交替對錯，拼寫打正解
  await p.click('#qzLearn'); await p.waitForTimeout(80);
  let mc = 0, wr = 0;
  for (let step = 0; step < 60; step++) {
    const s = await p.evaluate(() => { const d = QZ.dbg(); return d.L ? { kind: d.L.kind, state: d.L.state, term: d.L.cur && d.BY.get(d.L.cur).term, opts: d.L.opts } : null; });
    if (!s) break;
    if (s.kind === 'mc' && s.state === 'ask') {
      const want = mc % 2 === 0; mc++;
      const c = s.opts.findIndex(o => o === s.term);
      ok(c >= 0, `${name} Quizlet：正解不在選項裡`);
      await p.locator('.qz-choice').nth(want ? c : (c + 1) % s.opts.length).click();
      const st = await p.evaluate(() => QZ.dbg().L.state);
      ok(st === (want ? 'ok' : 'no'), `${name} Quizlet 選擇題判定錯誤 (want=${want}, state=${st})`);
      continue;
    }
    if (s.kind === 'write' && (s.state === 'ask')) {
      wr++;
      await p.fill('#qzIn', s.term); await p.press('#qzIn', 'Enter');
      const st = await p.evaluate(() => QZ.dbg().L.state);
      ok(st === 'ok', `${name} Quizlet 拼寫打正解卻沒判對 (${s.term} → ${st})`);
      continue;
    }
    if (s.kind === 'write' && s.state === 'retype') { await p.fill('#qzIn', s.term); await p.press('#qzIn', 'Enter'); continue; }
    if (await p.locator('#qzNext').count()) { await p.click('#qzNext'); continue; }
    break;
  }
  ok(mc > 0, `${name} Quizlet：沒有出現選擇題`);
  await p.click('#qzClose').catch(() => {});
}

// ---------------- 作文 ----------------
async function tEssay() {
  const p = await page('essay');
  const modes = ['flashcard', 'mc', 'spelling', 'cloze', 'dictation'];
  for (const mode of modes) {
    await p.click('#studyModeBtn'); await p.waitForTimeout(80);
    await p.click(`[data-mode="${mode}"]`);
    if (mode === 'dictation' || mode === 'flashcard') await p.evaluate(() => { const x = document.querySelector('[data-type="sentence"]'); if (x && !x.classList.contains('checked')) x.click(); });
    await p.locator('#startBtn').click();
    await p.waitForTimeout(80);
    const n = Math.min(6, await p.evaluate(() => __essay.session.cards.length));
    let right = 0;
    for (let i = 0; i < n; i++) {
      const card = await p.evaluate(() => { const s = __essay.session; const c = s.cards[s.idx]; return { word: c.word, type: c.type }; });
      const want = i % 2 === 0;
      const before = await p.evaluate(() => __fl().length);
      if (mode === 'flashcard') {
        // 點卡片左上角翻面（正中央可能剛好點到 🔊 朗讀鍵，那樣不會翻面）
        await p.click('#fcCard', { position: { x: 12, y: 12 } }); await p.click(`.rate-btn[data-rate="${want ? 2 : 0}"]`);
      } else if (mode === 'mc') {
        const opts = await p.locator('.mc-option').evaluateAll(b => b.map(x => x.dataset.val));
        const c = opts.indexOf(card.word);
        ok(c >= 0, '作文選擇題：正解不在選項裡 ' + card.word);
        ok(new Set(opts.map(o => o.toLowerCase())).size === opts.length, '作文選擇題：選項重複');
        await p.locator('.mc-option').nth(want ? c : (c + 1) % opts.length).click();
        const st = await p.evaluate(() => ({ wrong: !!document.querySelector('.mc-option.wrong'), correct: document.querySelectorAll('.mc-option.correct').length }));
        ok(st.correct === 1 && st.wrong === !want, '作文選擇題判定錯誤 ' + card.word);
        await p.click('#nextBtn');
      } else if (mode === 'spelling' || mode === 'cloze') {
        await p.fill('#spellInput', want ? card.word : 'zzzz'); await p.click('#spellSubmit');
        const fb = await p.locator('.spelling-feedback').getAttribute('class');
        ok(fb.includes(want ? 'correct' : 'wrong'), `作文${mode}判定錯誤 ${card.word}`);
        await p.click('#nextBtn');
      } else {
        await p.fill('#dictInput', want ? card.word : 'zzzz'); await p.click('#spellSubmit');
        const fb = await p.locator('.spelling-feedback').getAttribute('class');
        ok(fb.includes(want ? 'correct' : 'wrong'), '作文默寫判定錯誤');
        await p.click('#nextBtn');
      }
      const L = await p.evaluate(() => __fl()[__fl().length - 1]);
      ok((await p.evaluate(() => __fl().length)) === before + 1 && L[5] === (want ? 1 : 0), `作文${mode}：紀錄對錯不一致`);
      if (want) right++;
    }
    // 提早結束看結果
    if (await p.locator('#nextBtn, #endBtn, .drill-exit-btn').count()) await p.locator('.drill-exit-btn').first().click().catch(() => {});
    await p.waitForTimeout(80);
    const res = await p.evaluate(() => __essay.session && __essay.session.results.filter(r => r.correct).length);
    ok(res === right, `作文${mode}：session 答對數 ${res} 應為 ${right}`);
    await p.click('#studyModeBtn').catch(() => {});
    await p.waitForTimeout(80);
    if (await p.locator('#studyPanel #startBtn').count()) await p.click('#studyModeBtn');
  }
  await p.click('#faOpen'); ok(await p.locator('.fa-tiles').count(), '作文分析頁打不開'); await p.click('#faClose');
  await qz(p, '作文');
  ok(!p.errs.length, '作文頁面錯誤：' + p.errs.join(' | '));
}

// ---------------- 單元 ----------------
async function tUnits() {
  const p = await page('units');
  for (const mode of ['flash', 'zh', 'cloze', 'mc']) {
    await p.click('#studyBtn'); await p.waitForTimeout(80);
    await p.locator(`.pill[data-mode="${mode}"]`).first().click();
    await p.click('#startBtn'); await p.waitForTimeout(80);
    const n = Math.min(6, await p.evaluate(() => __units.S.items.length));
    let right = 0;
    for (let i = 0; i < n; i++) {
      const want = i % 2 === 0;
      const before = await p.evaluate(() => __fl().length);
      const it = await p.evaluate(() => { const S = __units.S, it = S.items[S.i]; return { w: it.w, target: it.en ? it.en.substr(it.ts, it.tl) : null, base: it.G ? (it.G.w[it.wi] || it.G.w[0])[0] : null, opts: it.opts }; });
      if (mode === 'flash') {
        await p.click('#fc'); await p.click(`[data-r="${want ? 2 : 0}"]`);
      } else if (mode === 'zh' || mode === 'cloze') {
        await p.fill('#ans', want ? (mode === 'zh' ? it.w : it.target) : 'zzzz'); await p.press('#ans', 'Enter');
        const okfb = await p.locator('#fb .fb').getAttribute('class');
        ok(okfb.includes(want ? 'ok' : 'no'), `單元${mode}判定錯誤 ${it.w || it.target}`);
        await p.click('#nextBtn');
      } else {
        const opts = await p.locator('#mcOpts [data-k]').evaluateAll(b => b.map(x => x.textContent.replace(/^\d/, '')));
        const c = opts.findIndex(o => o.toLowerCase() === it.base.toLowerCase());
        ok(c >= 0, '單元四選一：正解不在選項裡 ' + it.base);
        await p.locator('#mcOpts [data-k]').nth(want ? c : (c + 1) % opts.length).click();
        const okfb = await p.locator('#fb .fb').getAttribute('class');
        ok(okfb.includes(want ? 'ok' : 'no'), '單元四選一判定錯誤 ' + it.base);
        await p.click('#nextBtn');
      }
      const L = await p.evaluate(() => __fl()[__fl().length - 1]);
      ok((await p.evaluate(() => __fl().length)) === before + 1 && L[5] === (want ? 1 : 0), `單元${mode}：紀錄對錯不一致`);
      if (want) right++;
    }
    const sok = await p.evaluate(() => __units.S.ok);
    ok(sok === right, `單元${mode}：答對數 ${sok} 應為 ${right}`);
    if (mode === 'flash') { await p.click('#undoBtn'); ok((await p.evaluate(() => __units.S.i)) === n - 1, '單元單字卡：上一張沒作用'); await p.click('[data-r="2"]'); }
    await p.click('#quit'); await p.waitForTimeout(60);
    if (await p.locator('#redo').count()) { await p.click('#redo'); await p.click('#quit'); }
    await p.click('#toSetup'); await p.click('#backBrowse');
  }
  await p.click('#faOpen'); ok(await p.locator('.fa-tiles').count(), '單元分析頁打不開'); await p.click('#faClose');
  await qz(p, '單元');
  ok(!p.errs.length, '單元頁面錯誤：' + p.errs.join(' | '));
}

(async () => {
  browser = await chromium.launch();
  for (const [name, fn] of [['4500', t4500], ['essay', tEssay], ['units', tUnits]]) {
    try { await fn(); } catch (e) { fails.push(name + ' 測試中斷：' + e.message.split('\n')[0]); }
  }
  await browser.close();
  console.log(JSON.stringify(counts));
  console.log(fails.length ? 'FAIL\n' + [...new Set(fails)].join('\n') : 'ALL PASS');
})();
