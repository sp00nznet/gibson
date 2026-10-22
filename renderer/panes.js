// The panes of a tab as a split tree: a leaf holds a pane ({ p }), a split holds two nodes side by
// side ('row': a left, b right) or stacked ('col': a on top, b below), a getting `ratio` of the
// space. Pure logic, no DOM: app.js turns rects() into positions. Loaded by the page and by
// test/check.mjs, hence the export shim at the bottom.
(function (root) {
  const leaf = (p) => ({ p });
  const leaves = (n) => (!n ? [] : n.p !== undefined ? [n.p] : [...leaves(n.a), ...leaves(n.b)]);
  // Rebuilds the tree with fn applied to every node, bottom up; fn returning null drops that node.
  function map(n, fn) {
    if (!n) return null;
    if (n.p !== undefined) return fn(n);
    const a = map(n.a, fn), b = map(n.b, fn);
    return fn(a && b ? { ...n, a, b } : a || b);
  }
  // q goes beside p: after it (right/below), or before it with `before`.
  const split = (root, p, q, dir, before) => map(root, (n) => (n && n.p === p ? { dir, ratio: 0.5, a: before ? leaf(q) : n, b: before ? n : leaf(q) } : n));
  const remove = (root, p) => map(root, (n) => (n && n.p === p ? null : n));
  const swap = (root, p, q) => map(root, (n) => (n && n.p === p ? leaf(q) : n && n.p === q ? leaf(p) : n));
  // An even grid: as square as it goes, rows of equal panes, the last row stretched if short.
  function chain(nodes, dir) {
    if (nodes.length === 1) return nodes[0];
    return { dir, ratio: 1 / nodes.length, a: nodes[0], b: chain(nodes.slice(1), dir) };
  }
  function grid(ps) {
    if (!ps.length) return null;
    const cols = Math.ceil(Math.sqrt(ps.length)), rows = [];
    for (let i = 0; i < ps.length; i += cols) rows.push(chain(ps.slice(i, i + cols).map(leaf), 'row'));
    return chain(rows, 'col');
  }
  // Every run of same-way splits shares its space evenly.
  const span = (n, dir) => (n.dir === dir ? span(n.a, dir) + span(n.b, dir) : 1);
  const even = (root) => map(root, (n) => (n && n.dir ? { ...n, ratio: span(n.a, n.dir) / (span(n.a, n.dir) + span(n.b, n.dir)) } : n));
  // Where everything goes, as fractions of the tab: panes, and the splits (for the drag handles).
  function rects(n, x = 0, y = 0, w = 1, h = 1, out = { panes: [], splits: [] }) {
    if (!n) return out;
    if (n.p !== undefined) { out.panes.push({ p: n.p, x, y, w, h }); return out; }
    out.splits.push({ node: n, x, y, w, h });
    if (n.dir === 'row') { rects(n.a, x, y, w * n.ratio, h, out); rects(n.b, x + w * n.ratio, y, w * (1 - n.ratio), h, out); }
    else { rects(n.a, x, y, w, h * n.ratio, out); rects(n.b, x, y + h * n.ratio, w, h * (1 - n.ratio), out); }
    return out;
  }
  // The pane next door in a direction: touching that side, overlapping most, nearest first.
  function neighbour(root, p, dir) {
    const all = rects(root).panes, r = all.find((x) => x.p === p), e = 1e-6; if (!r) return null;
    const horiz = dir === 'left' || dir === 'right';
    const gap = (c) => ({ left: r.x - (c.x + c.w), right: c.x - (r.x + r.w), up: r.y - (c.y + c.h), down: c.y - (r.y + r.h) }[dir]);
    const overlap = (c) => (horiz ? Math.min(r.y + r.h, c.y + c.h) - Math.max(r.y, c.y) : Math.min(r.x + r.w, c.x + c.w) - Math.max(r.x, c.x));
    const best = all.filter((c) => c !== r && gap(c) > -e && overlap(c) > e).sort((a, b) => gap(a) - gap(b) || overlap(b) - overlap(a))[0];
    return best ? best.p : null;
  }
  // Moves the nearest gap of the right kind round p by d (left/up shrink the first side).
  function nudge(root, p, dir, d) {
    const want = dir === 'left' || dir === 'right' ? 'row' : 'col', sign = dir === 'left' || dir === 'up' ? -1 : 1;
    let hit = null;
    const walk = (n) => { if (!n || n.p !== undefined) return n && n.p === p; const inA = walk(n.a), inB = !inA && walk(n.b); if ((inA || inB) && !hit && n.dir === want) hit = n; return inA || inB; };
    walk(root);
    if (hit) hit.ratio = Math.max(0.08, Math.min(0.92, hit.ratio + sign * d));
    return !!hit;
  }
  // To and from plain data: leaves become whatever fn makes of the pane (and back).
  const save = (n, fn) => (!n ? null : n.p !== undefined ? { p: fn(n.p) } : { dir: n.dir, ratio: n.ratio, a: save(n.a, fn), b: save(n.b, fn) });
  const build = (n, fn) => (!n ? null : n.p !== undefined ? leaf(fn(n.p)) : { dir: n.dir === 'col' ? 'col' : 'row', ratio: Math.max(0.05, Math.min(0.95, Number(n.ratio) || 0.5)), a: build(n.a, fn), b: build(n.b, fn) });
  const load = (n, fn) => map(build(n, fn), (x) => (x && x.p === null ? null : x)); // a leaf fn can't place (null) is dropped

  const api = { leaf, leaves, split, remove, swap, grid, even, rects, neighbour, nudge, save, load, MAX: 16 };
  if (typeof module !== 'undefined') module.exports = api; else root.Panes = api;
})(this);
