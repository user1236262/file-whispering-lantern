import { readFileSync } from "node:fs";
import vm from "node:vm";
import { describe, expect, it } from "vitest";

function game() {
  const html = readFileSync("public/game/mars-base-buddies.html", "utf8");
  const script = html.match(/<script[^>]*>([\s\S]*?)<\/script>/g)?.find(s => s.includes("function de()"));
  if (!script) throw new Error("Game simulation missing");
  const context = vm.createContext({ console });
  vm.runInContext(readFileSync("public/game/solar-particles.js", "utf8"), context);
  vm.runInContext(script.slice(script.indexOf("var f = 3200"), script.indexOf("var He = _")), context);
  return (code: string) => vm.runInContext(code, context);
}

describe("Solar Particle Monitor game rules", () => {
  it("costs 35 materials and 20 energy and takes 7 seconds", () => {
    const run = game();
    expect(run("g.monitor.cost.materials")).toBe(35);
    expect(run("g.monitor.cost.energy")).toBe(20);
    expect(run("g.monitor.duration")).toBe(7);
    expect(run("h.includes('monitor')")).toBe(true);
  });
  it("starts with a primary 190 × 140 monitor at 1920, 820", () => {
    expect(game()("JSON.stringify(de().facilities.find(f=>f.kind==='monitor'))")).toContain('"x":1920,"y":820,"w":190,"h":140');
    expect(game()("de().facilities.find(f=>f.kind==='monitor').primary")).toBe(true);
  });
  it("uses 4 energy per Sol and can be switched off", () => {
    const run = game();
    expect(run("let s=de(); let off=Ce(s,'facility-toggle:base-monitor-1').sim; ye(s,1).usage-ye(off,1).usage")).toBe(4);
  });
  it("adds 7 percent during clear skies independently of monitor power", () => {
    expect(game()("let s=de(); s.facilities.find(f=>f.kind==='monitor').enabled=false; SolarParticles.advance(s,90,'clear',30,ce); s.solarParticles")).toBe(7);
  });
  it.each(["flare", "storm-flare"])("adds 28 percent during %s", weather => {
    expect(game()(`let s=de(); SolarParticles.advance(s,90,'${weather}',30,ce); s.solarParticles`)).toBe(28);
  });
  it("drains 50 energy, resets activity, and blackouts for 8 seconds", () => {
    const run = game();
    expect(run("let s=de(); s.energy=90; s.solarParticles=100; SolarParticles.advance(s,0,'clear',30,ce,()=>0); JSON.stringify([s.energy,s.solarParticles,s.flareBlackout])")).toBe("[40,0,8]");
    expect(run("_e(s,true)")).toBe(0);
  });
  it("breaks exactly one active electrical facility and repairs it for 10 materials", () => {
    const run = game();
    expect(run("let s=de(); s.solarParticles=100; SolarParticles.advance(s,0,'clear',30,ce,()=>0); s.facilities.filter(f=>f.damaged).length")).toBe(1);
    expect(run("let target=s.facilities.find(f=>f.damaged); let repaired=Ce(s,'facility-repair:'+target.id).sim; s.materials-repaired.materials")).toBe(10);
    expect(run("repaired.facilities.some(f=>f.damaged)")).toBe(false);
  });
  it("adds 20 radiation reduced by Shield percentage", () => {
    expect(game()("let s=de(); s.solarParticles=100; SolarParticles.advance(s,0,'clear',30,ce); s.exposure")).toBe(14);
  });
  it("armed protection drains only 15 energy, lasts 4 seconds and prevents damage", () => {
    expect(game()("let s=de(); s.energy=90; s.solarParticles=100; s.flareMitigated=true; SolarParticles.advance(s,0,'clear',30,ce); JSON.stringify([s.energy,s.flareBlackout,s.flareMitigated,s.facilities.some(f=>f.damaged)])")).toBe("[75,4,false,false]");
  });
  it("arming costs 15 energy and 10 materials and cannot charge twice", () => {
    const run = game();
    expect(run("let s=de(); let armed=Ce(s,'monitor-arm:base-monitor-1').sim; JSON.stringify([s.energy-armed.energy,s.materials-armed.materials,armed.flareMitigated])")).toBe("[15,10,true]");
    expect(run("Ce(armed,'monitor-arm:base-monitor-1').sim===armed")).toBe(true);
  });
  it("vents 25 percent for 20 energy without going below zero", () => {
    const run = game();
    expect(run("let s=de(); s.solarParticles=85; let vent=Ce(s,'monitor-vent:base-monitor-1').sim; JSON.stringify([vent.solarParticles,s.energy-vent.energy])")).toBe("[60,20]");
    expect(run("vent.solarParticles=10; Ce(vent,'monitor-vent:base-monitor-1').sim.solarParticles")).toBe(0);
  });
  it("rejects actions when supplies or monitor power are unavailable", () => {
    const run = game();
    expect(run("let s=de(); s.energy=14; Ce(s,'monitor-arm:base-monitor-1').sim===s")).toBe(true);
    expect(run("s.energy=19; Ce(s,'monitor-vent:base-monitor-1').sim===s")).toBe(true);
    expect(run("s.energy=70; s.facilities.find(f=>f.kind==='monitor').enabled=false; Ce(s,'monitor-arm:base-monitor-1').sim===s")).toBe(true);
  });
  it("issues a critical warning at 85 only with an operational powered monitor", () => {
    const run = game();
    expect(run("let s=de(); s.solarParticles=84; Be(s).some(a=>a.id==='solar-particles')")).toBe(false);
    expect(run("s.solarParticles=85; Be(s).find(a=>a.id==='solar-particles').level")).toBe(1);
    expect(run("s.facilities.find(f=>f.kind==='monitor').enabled=false; Be(s).some(a=>a.id==='solar-particles')")).toBe(false);
  });
  it("labels below 50 Calm, 50–84 Elevated, and 85–99 CRITICAL", () => {
    expect(game()("JSON.stringify([49,50,84,85,99].map(SolarParticles.level))")).toBe('["Calm","Elevated","Elevated","CRITICAL","CRITICAL"]');
  });
  it("interrupts non-essential buildings and restores power after countdown", () => {
    const run = game();
    expect(run("let s=de(); s.flareBlackout=8; let monitor=s.facilities.find(f=>f.kind==='monitor'); ce(s,monitor)")).toBe(false);
    expect(run("SolarParticles.advance(s,8,'clear',30,ce); ce(s,monitor)")).toBe(true);
  });
  it("defaults legacy save fields to 0, 0, false", () => {
    expect(game()("JSON.stringify(SolarParticles.defaults({}))")).toBe('{"solarParticles":0,"flareBlackout":0,"flareMitigated":false}');
  });
});