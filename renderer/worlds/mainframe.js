// MAINFRAME: a 1970s computer hall on a raised floor. Two rows of tall cabinets line the aisle:
// tape drives whose reels spin in bursts, front panels of blinking lamps, disk packs, and at the
// far end the console printer chattering out paper. Everything runs at the pace of your real CPU
// (env.procs), and the job queue in the corner is your actual busiest processes.
(function (Worlds) {
  Worlds.define('mainframe', (k) => {
    const { C, env, seg, setCam, lookAt, ring, box, hex } = k;
    const MONO = "'Cascadia Mono', Consolas, monospace", FOG = 40, N = 20, SP = 1.15, CW = 1.0, CH = 2.1, CD = 0.8;
    const FAKE = [{ name: 'PAYROLL', cpu: 22 }, { name: 'IEFBR14', cpu: 3 }, { name: 'SORT', cpu: 14 }, { name: 'COBOLRUN', cpu: 9 }, { name: 'LEDGER', cpu: 6 }, { name: 'SPOOL', cpu: 2 }];
    const hh = (a, b) => { let h = Math.imul(a * 374761393 + b * 668265263, 1274126177); h ^= h >>> 13; return (Math.imul(h, 1103515245) >>> 0) / 4294967296; };
    const kind = (i, side) => ['tape', 'lamps', 'tape', 'disk', 'lamps'][Math.floor(hh(i, side) * 5)];
    let spin = new Float32Array(N * 2), paper = 0, dump = [], dumpT = 0, cpu = 0;

    function reel(x, y, z, r, a, col) { // a reel facing the aisle (the yz plane), with three spokes
      let p = null;
      for (let i = 0; i <= 14; i++) { const t = i / 14 * Math.PI * 2, q = [x, y + Math.sin(t) * r, z + Math.cos(t) * r]; if (p) seg(...p, ...q, col, 0.85, FOG); p = q; }
      for (let s = 0; s < 3; s++) { const t = a + s * Math.PI * 2 / 3; seg(x, y, z, x, y + Math.sin(t) * r, z + Math.cos(t) * r, col, 0.7, FOG); }
    }
    const jobs = () => (env.procs && env.procs.length ? env.procs : FAKE).slice().sort((a, b) => b.cpu - a.cpu).slice(0, 8);

    return {
      label: 'MAINFRAME',
      update(dt) {
        const cores = (typeof navigator !== 'undefined' && navigator.hardwareConcurrency) || 1; // process CPU is per core, ps style
        const want = env.procs && env.procs.length ? Math.min(100, env.procs.reduce((a, p) => a + (p.cpu || 0), 0) / cores) : 10 + env.level * 80;
        cpu += (want - cpu) * Math.min(1, dt * 2);
        for (let i = 0; i < spin.length; i++) spin[i] += dt * (Math.sin(env.t * 0.8 + i * 1.7) > 0.2 ? 6 : 0.3) * (0.4 + cpu / 40); // reels run in bursts
        paper += dt * (0.05 + cpu / 600);
        dumpT -= dt; if (dumpT < 0) { dumpT = 0.4; dump = Array.from({ length: 6 }, (_, r) => (dump[r] && Math.random() < 0.7 ? dump[r] : `${hex(6)}  ${hex(4)} ${hex(4)} ${hex(4)} ${hex(4)}`)); }
      },
      draw() {
        const t = env.t, cz = 3 + Math.sin(t * 0.05) * 5;
        setCam(lookAt({ x: Math.sin(t * 0.11) * 0.25, y: 1.7, z: cz - 3 }, 0, 1.3, cz + 6));
        // the raised floor: tiles; the ceiling lights
        for (let x = -3; x <= 3; x += 1.2) seg(x, 0, -2, x, 0, N * SP + 4, C.violet, 0.22, FOG);
        for (let z = -2; z <= N * SP + 4; z += 1.2) seg(-3, 0, z, 3, 0, z, C.violet, 0.22, FOG);
        for (let z = 0; z < N * SP; z += 3) seg(-0.4, 3, z, 0.4, 3, z, C.white, 0.5, FOG);
        const rate = 2 + cpu / 8;
        for (let i = 0; i < N; i++) for (const side of [-1, 1]) {
          const z = 1 + i * SP; if (z < cz - 3.5) continue; const x = side * 1.5, fx = x - side * CD / 2, kd = kind(i, side), col = C.ice; // fx: the face toward the aisle
          box(x, 0, z, CD, CH, CW, col, 0.55, FOG);
          seg(fx, 0.2, z - CW / 2, fx, 0.2, z + CW / 2, col, 0.4, FOG);
          if (kd === 'tape') {
            const si = i * 2 + (side > 0 ? 1 : 0);
            reel(fx, 1.6, z - 0.22, 0.2, spin[si], C.white); reel(fx, 1.6, z + 0.22, 0.2, spin[si] * 0.8, C.white);
            seg(fx, 1.25, z - 0.4, fx, 1.25, z + 0.4, col, 0.5, FOG); // the head
            seg(fx, 0.5, z - 0.3, fx, 1.1, z - 0.3, col, 0.35, FOG); seg(fx, 0.5, z + 0.3, fx, 1.1, z + 0.3, col, 0.35, FOG); // the vacuum columns
          } else if (kd === 'lamps') {
            for (let r = 0; r < 4; r++) for (let c = 0; c < 6; c++) {
              const lit = hh(i * 97 + r * 8 + c, Math.floor(t * rate + hh(r, c) * 3)) > 0.55, y = 1.2 + r * 0.15, zz = z - 0.35 + c * 0.13;
              seg(fx, y, zz, fx, y, zz + 0.04, lit ? (r < 2 ? C.hot : C.gold) : C.violet, lit ? 1 : 0.3, FOG);
            }
            for (let c = 0; c < 8; c++) seg(fx, 0.9, z - 0.35 + c * 0.1, fx, 0.98, z - 0.35 + c * 0.1, C.white, 0.6, FOG); // the switches
          } else {
            for (let d = 0; d < 6; d++) ring(x, 1.0 + d * 0.06, z, 0.3, 12, C.white, 0.5, FOG); // a disk pack under its lid
            seg(fx, 1.55, z - 0.4, fx, 1.55, z + 0.4, col, 0.5, FOG);
          }
        }
        // the console printer at the end of the aisle, paper climbing out of it
        const pz = N * SP + 2;
        box(0, 0, pz, 1.4, 1.0, 0.7, C.gold, 0.7, FOG);
        for (let l = 0; l < 10; l++) {
          const y = 1.05 + ((l * 0.08 + paper) % 0.8), w = 0.15 + hh(l, Math.floor(paper * 12.5 + l)) * 0.4;
          seg(-0.45, y, pz - 0.2, -0.45 + w, y, pz - 0.2, C.white, 0.7 * (1 - (y - 1.05) / 0.8), FOG);
        }
        seg(-0.5, 1.0, pz - 0.2, -0.5, 1.9, pz - 0.15, C.white, 0.4, FOG); seg(0.5, 1.0, pz - 0.2, 0.5, 1.9, pz - 0.15, C.white, 0.4, FOG);
        hud();
      },
    };

    function hud() {
      const g = k.g, W = k.W, H = k.H, s = Math.min(W / 1920, H / 1080);
      g.font = `bold ${18 * s | 0}px ${MONO}`; g.fillStyle = `rgba(${C.gold},0.9)`; g.fillText('GIBSON SYSTEMS  ::  MODEL 70', 28 * s, 34 * s);
      const c = `CPU ${String(Math.round(cpu)).padStart(3)}%`; g.font = `bold ${22 * s | 0}px ${MONO}`; g.fillStyle = `rgba(${cpu > 80 ? C.hot : C.neon},0.95)`; g.fillText(c, W - 28 * s - g.measureText(c).width, 36 * s);
      g.font = `bold ${14 * s | 0}px ${MONO}`; g.fillStyle = `rgba(${C.ice},0.9)`; g.fillText('JOB QUEUE', 28 * s, H - 200 * s);
      g.font = `${13 * s | 0}px ${MONO}`;
      jobs().forEach((p, i) => { g.fillStyle = `rgba(${i ? C.white : C.gold},${i ? 0.7 : 1})`; g.fillText(`J${String(1000 + i * 37).slice(1)} ${String(p.name).toUpperCase().slice(0, 12).padEnd(12)} ${String(Math.round(p.cpu)).padStart(3)}%  ${i ? 'WAIT' : 'RUN '}`, 28 * s, H - (180 - i * 19) * s); });
      g.font = `${12 * s | 0}px ${MONO}`; g.fillStyle = `rgba(${C.neon},0.7)`;
      dump.forEach((l, i) => g.fillText(l, W - 28 * s - g.measureText(l).width, H - (30 + (dump.length - 1 - i) * 17) * s));
    }
  });
})(typeof Worlds !== 'undefined' ? Worlds : require('../worlds.js').Worlds);
