/* Browser-safe particle rules, also exercised by the game's regression tests. */
globalThis.SolarParticles = (() => {
  const colors = { outline: '#1e1b3a', shell: '#e5e7eb', dome: '#67e8f9', screen: '#164e63', telemetry: '#a3e635', calm: '#4ade80', elevated: '#fbbf24', critical: '#f43f5e', purple: '#c084fc', gold: '#fde047', off: '#64748b' };
  const meta = { name: 'Solar Particle Monitor', icon: '🛰️', description: 'Tracks solar particles and protects the grid. Uses 4 energy per Sol.', w: 190, h: 140, cost: { materials: 35, energy: 20 }, duration: 7, essential: false, controllable: true };
  const placement = { kind: 'monitor', x: 1920, y: 820, w: 190, h: 140 };
  const warning = 'Solar particle activity is at 85%! Visit the Solar Particle Monitor to vent capacitors or arm surge dampeners before the power grid overloads!';
  const clamp = (v, max = 100) => Math.max(0, Math.min(max, v));
  function defaults(state) {
    state.solarParticles = Number.isFinite(state.solarParticles) ? clamp(state.solarParticles) : 0;
    state.flareBlackout = Number.isFinite(state.flareBlackout) ? clamp(state.flareBlackout, 8) : 0;
    state.flareMitigated = state.flareMitigated === true;
    return state;
  }
  function advance(state, seconds, weather, shield, active, random = Math.random) {
    defaults(state);
    state.flareBlackout = Math.max(0, state.flareBlackout - seconds);
    state.solarParticles += (weather === 'flare' || weather === 'storm-flare' ? 28 : weather === 'clear' ? 7 : 0) * seconds / 90;
    if (state.solarParticles < 100) return false;
    state.solarParticles = 0;
    const mitigated = state.flareMitigated;
    state.flareMitigated = false;
    state.energy = clamp(state.energy - (mitigated ? 15 : 50));
    state.flareBlackout = mitigated ? 4 : 8;
    if (!mitigated) {
      const candidates = state.facilities.filter(f => ['solar', 'oxygen', 'greenhouse', 'drill'].includes(f.kind) && active(state, f));
      const target = candidates[Math.min(candidates.length - 1, Math.floor(random() * candidates.length))];
      if (target) target.damaged = true;
      state.exposure = clamp(state.exposure + 20 * (1 - shield / 100));
      state.peakExposure = Math.max(state.peakExposure, state.exposure);
    }
    return true;
  }
  function action(state, command) {
    if (command === 'monitor-arm') {
      if (state.flareMitigated) return { ok: false, msg: 'Grid surge dampeners are already armed.' };
      if (state.energy < 15 || state.materials < 10) return { ok: false, msg: 'Dampeners need 15 energy and 10 materials.' };
      state.energy -= 15; state.materials -= 10; state.flareMitigated = true;
      return { ok: true, msg: 'Grid surge dampeners ARMED for the next solar flare surge!' };
    }
    if (command === 'monitor-vent') {
      if (state.energy < 20) return { ok: false, msg: 'Venting needs 20 energy.' };
      state.energy -= 20; state.solarParticles = clamp(state.solarParticles - 25);
      return { ok: true, msg: 'Particle capacitors vented — activity reduced by 25%.' };
    }
    return { ok: false, msg: 'Unknown monitor action.' };
  }
  const level = v => v >= 85 ? 'CRITICAL' : v >= 50 ? 'Elevated' : 'Calm';
  function draw(ctx, f, time = 0, particles = 0, powered = true) {
    const { x, y, w, h } = f;
    ctx.save(); ctx.translate(x, y); ctx.scale(w / 190, h / 140);
    ctx.strokeStyle = colors.outline; ctx.lineWidth = 4;
    ctx.fillStyle = colors.shell; ctx.beginPath(); ctx.roundRect(5, 70, 180, 66, 12); ctx.fill(); ctx.stroke();
    ctx.fillStyle = colors.dome; ctx.beginPath(); ctx.ellipse(95, 76, 84, 60, 0, Math.PI, 0); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(95, 19); ctx.lineTo(95, 73); ctx.stroke();
    for (const sx of [24, 120]) {
      ctx.fillStyle = colors.screen; ctx.beginPath(); ctx.roundRect(sx, 85, 46, 29, 4); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = powered ? colors.telemetry : colors.off; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(sx + 4, 105); ctx.lineTo(sx + 12, 100); ctx.lineTo(sx + 20, 107); ctx.lineTo(sx + 27, 92 + Math.sin(time * 3) * 4); ctx.lineTo(sx + 40, 100); ctx.stroke(); ctx.strokeStyle = colors.outline; ctx.lineWidth = 4;
    }
    ctx.save(); ctx.translate(95, 26); ctx.rotate(powered ? Math.sin(time * 0.7) * 0.55 : 0);
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -23); ctx.stroke();
    ctx.fillStyle = colors.shell; ctx.beginPath(); ctx.ellipse(0, -23, 32, 12, -0.3, 0, Math.PI); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, -23); ctx.lineTo(9, -38); ctx.stroke(); ctx.restore();
    ctx.fillStyle = !powered ? colors.off : particles < 50 ? colors.calm : particles < 85 ? colors.elevated : Math.sin(time * 9) > 0 ? colors.critical : colors.outline;
    ctx.beginPath(); ctx.arc(151, 34, 7, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = colors.outline; ctx.font = 'bold 13px Nunito, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('PARTICLE MONITOR', 95, 130); ctx.restore();
  }
  function sparks(ctx, facilities, time) {
    ctx.save(); ctx.strokeStyle = colors.gold; ctx.lineWidth = 4; ctx.shadowColor = colors.purple; ctx.shadowBlur = 12;
    for (const f of facilities.filter(f => f.kind === 'solar' && f.remaining <= 0)) {
      ctx.beginPath(); ctx.moveTo(f.x + 15, f.y + 30);
      for (let i = 1; i < 8; i++) ctx.lineTo(f.x + f.w * i / 8, f.y + 30 + Math.sin(time * 24 + i * 5) * 26);
      ctx.stroke();
    }
    ctx.restore();
  }
  function aurora(ctx, width, height, time) {
    ctx.save(); ctx.globalAlpha = 0.2 + Math.abs(Math.sin(time * 8)) * 0.2;
    for (let band = 0; band < 3; band++) {
      ctx.strokeStyle = band % 2 ? colors.gold : colors.purple; ctx.lineWidth = 22;
      ctx.beginPath(); ctx.moveTo(0, height * 0.13 + band * 25);
      for (let x = 0; x <= width; x += 15) ctx.lineTo(x, height * 0.13 + band * 25 + Math.sin(x / 100 + time * 2 + band) * 26);
      ctx.stroke();
    }
    ctx.restore();
  }
  return { meta, placement, warning, defaults, advance, action, level, draw, sparks, aurora };
})();