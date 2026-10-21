A4500 = r"""function () {
  const groups = CATS.map(c => ({ id: c.id, name: c.name }));
  const exOf = (s, a, t) => ({ exFront: s.replace(/___/g, '_____'), exFull: (() => { const p = a.split(' … '); let i = 0; return s.replace(/___/g, () => p[Math.min(i++, p.length - 1)]); })(), exHi: a.split(' … ')[0], exZh: t });
  const items = D.map(e => {
    // 原本的例句＋隱藏例句（EXS）：每次出題時隨機換一句
    const vs = [[e.s, e.a, e.t]].concat((typeof EXS !== 'undefined' && EXS[e.w + '|' + e.zh]) || []);
    const alts = e.a.includes('…') ? [] : [...new Set(vs.map(v => v[1]).filter(a => !a.includes('…')))];
    return Object.assign({ id: e.w + '|' + e.zh, g: e.c, term: e.w, alts, zh: e.zh, pos: (POS[e.p] || [''])[0], kk: e.kk, note: e.n, img: e.img || '', vars: vs.map(v => exOf(...v)) }, exOf(e.s, e.a, e.t));
  });
  return { app: '4500', title: '4500 多義', groupLabel: '分類', groups, items };
}"""

ESSAY = r"""function () {
  const el = document.getElementById('vocab-data'); if (!el) return null;
  const d = JSON.parse(el.textContent);
  const groups = d.categories.map((c, i) => {
    const m = c.name.match(/（([^）]+)）/);
    return { id: 'c' + i, name: (i + 1) + '. ' + (m ? m[1] : c.name.replace(/^\d+\.\s*/, '')) };
  });
  const escRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  function blank(word, ex) {
    if (!ex) return null;
    const ps = window.phraseSpans && window.phraseSpans(word, ex);   // 片語：每一段（含介系詞）都挖空
    if (ps) { let f = '', p = 0; ps.forEach(x => { f += ex.slice(p, x.index) + '_____'; p = x.index + x.matched.length; }); return { front: f + ex.slice(p), hit: ps[0].matched }; }
    const w = word.trim();
    let m = ex.match(new RegExp('\\b' + escRe(w) + '\\b', 'i'));
    if (!m && !/\s/.test(w) && w.length > 3) {
      let stem = w.replace(/(e|y)$/i, '');
      m = ex.match(new RegExp('\\b' + escRe(stem) + '[a-z]*', 'i'));
      if (!m && w.length > 5) m = ex.match(new RegExp('\\b' + escRe(w.slice(0, w.length - 2)) + '[a-z]*', 'i'));
    }
    if (!m) return null;
    return { front: ex.slice(0, m.index) + '_____' + ex.slice(m.index + m[0].length), hit: m[0] };
  }
  const items = [];
  d.categories.forEach((c, i) => (c.rows || []).forEach(r => {
    const [word, kk, pos, zh, ex, colloc, exZh] = r;
    if (!word || !zh) return;
    const b = blank(word, ex);
    items.push({ id: word + '|' + zh, g: 'c' + i, term: word, alts: b ? [b.hit] : [], zh, pos: pos === 'phrase' ? '片語' : pos, kk: kk && kk !== '—' ? kk : '',
      exFront: b ? b.front : '', exFull: ex || '', exHi: b ? b.hit : word, exZh: exZh || '', note: colloc || '' });
  }));
  return { app: 'essay', title: '作文單字庫', groupLabel: '分類', groups, items, anchor: '#studyModeBtn' };
}"""

UNITS = r"""function () {
  const el = document.getElementById('data'); if (!el) return null;
  const UN = JSON.parse(el.textContent);
  const groups = UN.map(U => ({ id: U.u, name: '第 ' + U.u + ' 單元', short: String(U.u) }));
  const items = [];
  UN.forEach(U => U.g.forEach((G, gi) => G.w.forEach((W, wi) => {
    if (W[4]) return;
    const zh = W[3].map(s => s[1]).filter(Boolean).join('；');
    if (!/[一-鿿]/.test(zh)) return;
    const E = G.e.find(E => E[4] === wi && E[2] >= 0);
    const posList = [...new Set(W[3].map(s => s[0]).filter(Boolean))];
    let exFront = '', exHi = W[0];
    if (E) { exHi = E[0].substr(E[2], E[3]); exFront = E[0].slice(0, E[2]) + '_____' + E[0].slice(E[2] + E[3]); }
    items.push({ id: U.u + '-' + gi + '-' + wi, g: U.u, term: W[0], alts: E ? [exHi] : [], zh, pos: posList.join(' '), kk: W[2] ? '[' + W[2] + ']' : '',
      exFront, exFull: E ? E[0] : '', exHi, exZh: E ? E[1] : '', note: W[3].map(s => s[2]).filter(Boolean).map(x => '= ' + x).join('；'), head: wi === 0 });
  })));
  return { app: 'units', title: '單元單字庫', groupLabel: '單元', groups, items, compactGroups: true, anchor: '#studyBtn',
    filters: [{ key: 'head', label: '只練主單字（不含衍生字）', fn: it => it.head }] };
}"""

import sys
def inject(path, adapter, out):
    s = open(path, encoding='utf-8').read()
    mod = open('tools/quizlet/module.html', encoding='utf-8').read().replace('__ADAPTER__', adapter)
    # remove an older injected copy if present
    a = s.find('<style id="qz-style">')
    if a >= 0:
        b = s.find('window.QZ = {', a); b = s.find('</script>', b) + len('</script>')
        s = s[:a] + s[b:].lstrip('\n')
    i = s.rfind('</body>')
    s = (s[:i] + mod + '\n' + s[i:]) if i >= 0 else (s.rstrip() + '\n' + mod)
    open(out, 'w', encoding='utf-8').write(s)

if __name__ == '__main__':
    which, src, out = sys.argv[1:4]
    inject(src, {'4500': A4500, 'essay': ESSAY, 'units': UNITS}[which], out)
    print('injected', which, '->', out)
