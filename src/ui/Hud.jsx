import React from 'react';
import { CROPS, FEED_COST, FIELD_OFFSET, FIELD_SIZE, SEASONS, SEASON_ACTIONS, WATER_DAYS, elevatorIntake, fieldHeight, seasonForDay, yearForDay, dayOfSeason, SEASON_LENGTH, storedTotal, UPGRADES, upgradeCost } from '../game/constants.js';
import { storageCapacity } from '../game/logic.js';
import './hud.css';

export default function Hud({ gs, actions }) {
  const season = seasonForDay(gs.day);
  const sd = SEASONS[season];
  const actionList = SEASON_ACTIONS[season];
  const cropEntries = Object.entries(CROPS);

  const harvested = cropEntries.map(([id, c]) => ({ id, c, count: gs.inventory[id] || 0 }));
  const totalHarvested = harvested.reduce((s, h) => s + h.count, 0);
  const capacity = storageCapacity(gs.buildings, gs.upgrades?.silo || 0);
  const curAction = actionList.find((a) => a.id === gs.selectedAction);

  // Seasonal accent flows through CSS variables so the wood/parchment theme stays
  // constant while the accent (rings, glows, the Next button) tints per season.
  const seasonVars = {
    '--season': sd.ui.primary,
    '--season-2': sd.ui.secondary,
    '--season-deep': sd.ui.border,
    '--season-soft': sd.ui.bg,
  };

  return (
    <div className="hud" style={seasonVars}>
      {/* Title (desktop) */}
      <div className="hud-title">🌾 Hank's Homestead</div>

      {/* ===== Mobile status bar (top) ===== */}
      <div className="m-topbar">
        <div className="m-season">
          <span className="m-season-ico">{sd.icon}</span>
          <span className="m-season-txt">
            <b>{sd.name}</b>
            <small>Yr {yearForDay(gs.day)} · Day {dayOfSeason(gs.day)}/{SEASON_LENGTH}</small>
          </span>
        </div>
        <div className="m-stats">
          <span className="m-pill gold">🪙 {gs.gold}</span>
          <button className="m-pill store" onClick={actions.openMarket}>🎒 {totalHarvested}/{capacity}</button>
        </div>
      </div>

      {/* ===== Mobile economy buttons (right edge) ===== */}
      <div className="m-econ">
        <button onClick={actions.openMarket}><span className="me-ico">🌾</span><span className="me-lbl">Sell</span></button>
        <button onClick={actions.toggleShop}><span className="me-ico">🏪</span><span className="me-lbl">Seeds</span></button>
        <button onClick={actions.toggleStore}><span className="me-ico">🚜</span><span className="me-lbl">Supply</span></button>
        <button className="me-reset" onClick={actions.resetGame}><span className="me-ico">↺</span><span className="me-lbl">Reset</span></button>
      </div>

      {/* ===== Mobile camera controls (left edge) ===== */}
      <div className="m-cam">
        <button onClick={() => actions.rotateCam(-1)} aria-label="Rotate left">⟲</button>
        <button className={gs.camTop ? 'active' : ''} onClick={actions.toggleTopView} aria-label="Toggle top view">
          {gs.camTop ? 'Iso' : 'Top'}
        </button>
        <button onClick={() => actions.rotateCam(1)} aria-label="Rotate right">⟳</button>
      </div>

      {/* ===== Advisor portrait + live indicators + job queue (all platforms) ===== */}
      <div className="left-stack">
        <AdvisorDock gs={gs} actions={actions} />
        <Indicators gs={gs} actions={actions} season={season} />
        <JobQueue gs={gs} actions={actions} />
      </div>

      {/* Season (top-left, desktop) */}
      <div className="season-chip">
        <span className="season-icon">{sd.icon}</span>
        <span className="season-name">{sd.name}</span>
      </div>

      {/* Top-right controls (desktop) */}
      <div className="topright">
        <button className="shop-btn" onClick={actions.openMarket}>🌾 Sell</button>
        <button className={`shop-btn ${gs.showShop ? 'active' : ''}`} onClick={actions.toggleShop}>
          🏪 Shop
        </button>
        <button className="shop-btn" onClick={actions.toggleStore}>🚜 Supply</button>
        <button className="icon-btn" title="Almanac" onClick={() => actions.openAlmanac()}>📖</button>
        <button className="icon-btn" title="Reset game" onClick={actions.resetGame}>↺</button>
      </div>

      {/* Shop panel (desktop top-right panel; bottom sheet on mobile) */}
      {gs.showShop && (
        <>
          <div className="m-sheet-backdrop" onPointerDown={actions.toggleShop} />
          <div className="panel shop-panel">
            <div className="panel-head">
              <span>Buy Seeds</span>
              <span className="gold">🪙 {gs.gold}</span>
            </div>
            {cropEntries.map(([id, c]) => (
              <div className="shop-row" key={id}>
                <span className="shop-icon">{c.icon}</span>
                <span className="shop-name">
                  {c.name}
                  <small className="shop-stats">
                    sells ~{c.sellPrice}g · {c.shelfLife >= 999 ? 'keeps ∞' : `keeps ~${c.shelfLife}d`} · 💧×{Math.max(0, c.growTime - 5)}
                  </small>
                </span>
                <span className="shop-price">{c.seedPrice}g</span>
                <button disabled={gs.gold < c.seedPrice} onClick={() => actions.buySeeds(id, 1)}>+1</button>
                <button disabled={gs.gold < c.seedPrice * 5} onClick={() => actions.buySeeds(id, 5)}>+5</button>
              </div>
            ))}
            <button className="sheet-close" onClick={actions.toggleShop}>Done</button>
          </div>
        </>
      )}

      {/* Inventory (left-center) */}
      <div className="inventory">
        <div className="inv-head">🎒 {totalHarvested}/{capacity}</div>
        <div className="inv-bar">
          <div
            className={`inv-bar-fill ${totalHarvested >= capacity ? 'full' : ''}`}
            style={{ width: `${Math.min(100, (totalHarvested / capacity) * 100)}%` }}
          />
        </div>
        {harvested.map(({ id, c, count }) => (
          <div className={`inv-item ${count > 0 ? '' : 'empty'}`} key={id}>
            <span className="inv-icon">{c.icon}</span>
            <span className="inv-count">{count}</span>
          </div>
        ))}
      </div>

      {/* Notification */}
      {gs.notification && (
        <div className={`notification ${gs.notification.type}`}>{gs.notification.msg}</div>
      )}

      {/* Bottom-left: gold + day */}
      <div className="botleft">
        <div className="gold-display">🪙 {gs.gold}</div>
        <div className="day-display">Yr {yearForDay(gs.day)} · Day {dayOfSeason(gs.day)}/{SEASON_LENGTH}</div>
      </div>

      {/* Crop selector (plant) */}
      {gs.selectedAction === 'plant' && (
        <div className="child-panel crop-panel">
          {cropEntries.map(([id, c]) => {
            const seeds = gs.inventory[`${id}_seeds`] || 0;
            return (
              <button
                key={id}
                className={`crop-cell ${gs.selectedCrop === id ? 'active' : ''}`}
                title={`${c.icon} ${c.name}`}
                onClick={() => actions.selectCrop(id)}
              >
                <span className="cell-icon">{c.icon}</span>
                <span className={`seed-badge ${seeds > 0 ? '' : 'out'}`}>{seeds}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Sell panel (winter inline) */}
      {gs.selectedAction === 'sell' && (
        <div className="child-panel sell-panel">
          <div className="sell-head">💰 Sell Your Harvest</div>
          {totalHarvested > 0 ? (
            <div className="sell-row-wrap">
              {harvested.filter((h) => h.count > 0).map(({ id, c, count }) => (
                <button className="sell-item" key={id} onClick={() => actions.sellItem(id)}>
                  <span>{c.icon} ×{count}</span>
                  <span className="gold">{gs.prices?.[id] ?? c.sellPrice}g</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="sell-empty">No crops to sell</div>
          )}
        </div>
      )}

      {/* Action bar (bottom-center) */}
      <div className="action-bar">
        {actionList.map((a, i) => (
          <button
            key={a.id}
            className={`action-cell ${gs.selectedAction === a.id ? 'active' : ''}`}
            onClick={() => actions.selectAction(a.id)}
          >
            <span className="keybind">{i + 1}</span>
            <span className="action-icon">{a.icon}</span>
            <span className="action-name">{a.name}</span>
            {a.id === 'clean' && <span className="action-cost">−{FEED_COST}g</span>}
          </button>
        ))}
      </div>

      {/* Next Turn (bottom-right) */}
      <button className="next-turn" onClick={actions.advanceDay}>
        <span className="arrow">→</span>
        <span className="next-label">NEXT</span>
      </button>

      {/* On-screen touch controls: centered D-pad with a center Act button.
          Tap center = act; long-press = action/crop menu. (shown on touch via CSS) */}
      <TouchControls
        gs={gs}
        actions={actions}
        actionList={actionList}
        curAction={curAction}
        cropEntries={cropEntries}
      />

      {/* Market + Farm Supply + Almanac modals */}
      {gs.showSellModal && <SellModal gs={gs} actions={actions} />}
      {gs.showStore && <Store gs={gs} actions={actions} />}
      {gs.showAlmanac && <Almanac gs={gs} actions={actions} />}
    </div>
  );
}

// ============================================
// ADVISOR DOCK — Hank's portrait; his lines dock here (not in the 3D world).
// Tapping the portrait opens the Almanac.
// ============================================
function AdvisorDock({ gs, actions }) {
  return (
    <div className="advisor">
      <button className="advisor-face" onClick={() => actions.openAlmanac()} aria-label="Open Hank's Almanac">
        👨‍🌾
      </button>
      {gs.speechBubble && !gs.showSellModal && !gs.showAlmanac && (
        <div className="advisor-bubble">{gs.speechBubble}</div>
      )}
    </div>
  );
}

// ============================================
// INDICATORS — live condition chips; each deep-links into the Almanac.
// ============================================
function Indicators({ gs, actions, season }) {
  const fh = fieldHeight(gs.upgrades);
  let thirsty = 0;
  let withered = 0;
  for (let y = FIELD_OFFSET; y < FIELD_OFFSET + fh; y++) {
    for (let x = FIELD_OFFSET; x < FIELD_OFFSET + FIELD_SIZE; x++) {
      const cell = gs.grid[y]?.[x];
      if (!cell || !cell.crop) continue;
      if (cell.harvestPenalty) withered++;
      else if (season === 'summer' && cell.growth < CROPS[cell.crop].growTime && (cell.moisture || 0) === 0) thirsty++;
    }
  }
  const stored = storedTotal(gs.inventory);
  const cap = storageCapacity(gs.buildings, gs.upgrades?.silo || 0);
  const dueSoon = (gs.contracts || []).filter((k) => k.due - gs.day <= 2);
  const sellNow = Object.keys(CROPS).filter(
    (id) => (gs.inventory[id] || 0) > 0 && (gs.prices?.[id] ?? CROPS[id].sellPrice) >= CROPS[id].sellPrice * 1.15
  );

  const chips = [];
  if (gs.scorchDay === gs.day) chips.push({ key: 'scorch', cls: 'hot', txt: '🔥 Scorcher', topic: 'water' });
  if (thirsty > 0) chips.push({ key: 'thirsty', cls: 'warn', txt: `🥵 ${thirsty} dry`, topic: 'water' });
  if (withered > 0) chips.push({ key: 'wither', cls: 'warn', txt: `🥀 ${withered}`, topic: 'water' });
  if (cap > 0 && stored / cap >= 0.8) chips.push({ key: 'store', cls: 'warn', txt: `🎒 ${Math.round((stored / cap) * 100)}%`, topic: 'market' });
  if (dueSoon.length > 0)
    chips.push({ key: 'contract', cls: 'hot', txt: `📜 due ${Math.max(0, Math.min(...dueSoon.map((k) => k.due - gs.day)))}d`, topic: 'market' });
  if (sellNow.length > 0) chips.push({ key: 'sell', cls: 'good', txt: `📈 ${sellNow.map((id) => CROPS[id].icon).join('')}`, topic: 'market' });

  if (chips.length === 0) return null;
  return (
    <div className="indicators">
      {chips.map((c) => (
        <button key={c.key} className={`ind-chip ${c.cls}`} onClick={() => actions.openAlmanac(c.topic)}>
          {c.txt}
        </button>
      ))}
    </div>
  );
}

// ============================================
// JOB QUEUE — RTS-style command queue. The running job shows remaining tiles;
// queued jobs wait their turn. ✕ cancels.
// ============================================
const ACTION_ICONS = { plant: '🌱', water: '💧', clean: '🧪', harvest: '✂️' };

function JobQueue({ gs, actions }) {
  const a = gs.activeJob;
  const queued = gs.jobs || [];
  if (!a && queued.length === 0) return null;
  const remaining = gs.isAutoActing ? gs.autoActionQueue.length : a ? a.total : 0;
  return (
    <div className="jobq">
      {a && (
        <div className="jq-chip active">
          <span className="jq-ico">{ACTION_ICONS[a.action] || '⚙️'}</span>
          {a.crop && <span className="jq-ico">{CROPS[a.crop].icon}</span>}
          <span className="jq-n">×{remaining}</span>
          <button className="jq-x" onClick={actions.cancelActiveJob} aria-label="Cancel current job">✕</button>
        </div>
      )}
      {queued.map((j) => (
        <div className="jq-chip" key={j.id}>
          <span className="jq-ico">{ACTION_ICONS[j.action] || '⚙️'}</span>
          {j.crop && <span className="jq-ico">{CROPS[j.crop].icon}</span>}
          <span className="jq-n">×{j.total}</span>
          <button className="jq-x" onClick={() => actions.cancelJob(j.id)} aria-label="Remove queued job">✕</button>
        </div>
      ))}
    </div>
  );
}

// ============================================
// ALMANAC — the system explainer, deep-linked from indicators & the portrait.
// ============================================
const CROP_NICHES = {
  wheat: 'Cheap & safe. Keeps forever — hold it and sell at the spring peak.',
  carrot: 'Budget crop. Needs the least summer watering.',
  tomato: 'Best gold-for-gold at harvest. Spoils fast — sell right away.',
  corn: 'Stores well — the other crop worth holding for spring (some spoilage).',
  pumpkin: 'Biggest payout per tile. Pricey seeds, thirstiest, spoils — fall cash.',
};

function Almanac({ gs, actions }) {
  const topics = [
    { id: 'calendar', name: '📅 Seasons' },
    { id: 'water', name: '💧 Water' },
    { id: 'crops', name: '🌱 Crops' },
    { id: 'market', name: '💰 Market' },
  ];
  const t = gs.almanacTopic || 'calendar';
  return (
    <div className="modal-backdrop">
      <div className="modal almanac">
        <h2>📖 Hank's Almanac</h2>
        <div className="alm-tabs">
          {topics.map((x) => (
            <button key={x.id} className={`alm-tab ${t === x.id ? 'active' : ''}`} onClick={() => actions.setAlmanacTopic(x.id)}>
              {x.name}
            </button>
          ))}
        </div>

        <div className="alm-body">
          {t === 'calendar' && (
            <>
              <div className="alm-row"><span className="alm-ico">🌸</span><div><b>Spring — plant.</b> Rain waters the field for free. Anything not planted by summer waits a whole year.</div></div>
              <div className="alm-row"><span className="alm-ico">☀️</span><div><b>Summer — water & feed.</b> Soil dries every day; crops only grow on moist soil. Feed (−{FEED_COST}g) doubles a crop's harvest.</div></div>
              <div className="alm-row"><span className="alm-ico">🍂</span><div><b>Fall — harvest.</b> Ripe crops go into storage. Unharvested crops are lost when spring returns!</div></div>
              <div className="alm-row"><span className="alm-ico">❄️</span><div><b>Winter — sell (or hold).</b> The elevator buys year-round — winter is planning time, and prices climb toward spring.</div></div>
              <div className="alm-row"><span className="alm-ico">🎯</span><div>Drag across tiles to queue work for Hank — queue several jobs and he'll run them in order.</div></div>
            </>
          )}
          {t === 'water' && (
            <>
              <div className="alm-row"><span className="alm-ico">💧</span><div>One watering keeps soil moist for <b>{WATER_DAYS} days</b>. The dirt shows it:
                <span className="soil-key"><i style={{ background: '#5C4033' }} /> wet <i style={{ background: '#77512E' }} /> drying <i style={{ background: '#8B5A2B' }} /> parched</span></div></div>
              <div className="alm-row"><span className="alm-ico">🔥</span><div><b>Scorchers</b> (about 1 day in 3) dry soil twice as fast. The light goes harsh and amber — water that day.</div></div>
              <div className="alm-row"><span className="alm-ico">🥀</span><div>A crop on parched soil <b>withers</b> — it droops and shrinks. It still harvests, but the feed bonus — and the {FEED_COST}g you paid — is gone. Ready crops stand tall and <b>sparkle</b>.</div></div>
              <div className="alm-row"><span className="alm-ico">💦</span><div><b>Sprinklers</b> water every thirsty tile each morning (1g/tile) — scorcher-proof, hands-free.</div></div>
            </>
          )}
          {t === 'crops' && (
            <>
              <div className="alm-note">🧪 Feed costs {FEED_COST}g a tile and doubles that harvest — unless the crop withers.</div>
              {Object.entries(CROPS).map(([id, c]) => (
                <div className="alm-crop" key={id}>
                  <span className="alm-ico">{c.icon}</span>
                  <div>
                    <b>{c.name}</b>
                    <small>
                      {c.seedPrice}g seed · sells ~{c.sellPrice}g · {c.shelfLife >= 999 ? 'keeps ∞' : `keeps ~${c.shelfLife}d`} · 💧×{Math.max(0, c.growTime - 5)}
                    </small>
                    <small className="alm-niche">{CROP_NICHES[id]}</small>
                  </div>
                </div>
              ))}
            </>
          )}
          {t === 'market' && (
            <>
              <div className="alm-row"><span className="alm-ico">📈</span><div>Prices <b>peak in spring</b> (lean season) and <b>bottom out in fall</b> (harvest glut). The sparklines in the Sell window show the trend.</div></div>
              <div className="alm-row"><span className="alm-ico">⚖️</span><div>Dumping a big pile walks the price down as you sell. <b>Spread sales across days</b> and the market recovers between.</div></div>
              <div className="alm-row"><span className="alm-ico">🚛</span><div>The elevator only takes so many <b>bushels per day</b> — a big harvest must be divvied out over the cycle. Haulers raise the daily intake.</div></div>
              <div className="alm-row"><span className="alm-ico">🎒</span><div>Storage is limited — silos add room. Perishables rot a little every day; grain keeps.</div></div>
              <div className="alm-row"><span className="alm-ico">📜</span><div><b>Contracts</b> lock a price now for delivery later — a hedge for crops that won't keep. Miss delivery and pay a 25% penalty.</div></div>
            </>
          )}
        </div>

        <button className="alm-close" onClick={actions.closeAlmanac}>Done</button>
      </div>
    </div>
  );
}

function TouchControls({ gs, actions, actionList, curAction, cropEntries }) {
  const [menuOpen, setMenuOpen] = React.useState(false);
  const timer = React.useRef(null);
  const longPressed = React.useRef(false);

  const startPress = () => {
    longPressed.current = false;
    timer.current = setTimeout(() => {
      longPressed.current = true;
      setMenuOpen(true);
    }, 420);
  };
  const endPress = () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    if (!longPressed.current) actions.act(); // it was a tap
  };
  const cancelPress = () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  };

  const pickAction = (id) => {
    actions.selectAction(id);
    if (id !== 'plant') setMenuOpen(false); // plant stays open to choose a crop
  };
  const pickCrop = (id) => {
    actions.selectCrop(id);
    setMenuOpen(false);
  };

  return (
    <div className="touch-controls">
      {menuOpen && <div className="tc-backdrop" onPointerDown={() => setMenuOpen(false)} />}
      {menuOpen && (
        <div className="tc-menu">
          <div className="tc-menu-actions">
            {actionList.map((a) => (
              <button
                key={a.id}
                className={`tc-action ${gs.selectedAction === a.id ? 'active' : ''}`}
                onClick={() => pickAction(a.id)}
              >
                <span className="tc-ico">{a.icon}</span>
                <span className="tc-name">{a.name}</span>
                {a.id === 'clean' && <span className="tc-cost">−{FEED_COST}g</span>}
              </button>
            ))}
          </div>
          {gs.selectedAction === 'plant' && (
            <div className="tc-menu-crops">
              {cropEntries.map(([id, c]) => {
                const seeds = gs.inventory[`${id}_seeds`] || 0;
                return (
                  <button
                    key={id}
                    className={`tc-crop ${gs.selectedCrop === id ? 'active' : ''}`}
                    onClick={() => pickCrop(id)}
                  >
                    <span className="tc-ico">{c.icon}</span>
                    <span className={`tc-seed ${seeds > 0 ? '' : 'out'}`}>{seeds}</span>
                  </button>
                );
              })}
            </div>
          )}
          <button className="tc-done" onClick={() => setMenuOpen(false)}>Done</button>
        </div>
      )}

      <div className="dpad-cluster">
        <button className="dpad-btn up" onClick={() => actions.move('up')} aria-label="Move up">▲</button>
        <button className="dpad-btn left" onClick={() => actions.move('left')} aria-label="Move left">◀</button>
        <button
          className="act-btn"
          onPointerDown={startPress}
          onPointerUp={endPress}
          onPointerLeave={cancelPress}
          onPointerCancel={cancelPress}
          onContextMenu={(e) => e.preventDefault()}
          aria-label="Do action (long-press for menu)"
        >
          {curAction?.icon || '✋'}
        </button>
        <button className="dpad-btn right" onClick={() => actions.move('right')} aria-label="Move right">▶</button>
        <button className="dpad-btn down" onClick={() => actions.move('down')} aria-label="Move down">▼</button>
      </div>
    </div>
  );
}

function Store({ gs, actions }) {
  return (
    <div className="modal-backdrop">
      <div className="modal store-modal">
        <h2>🚜 Farm Supply</h2>
        <p className="modal-sub">Invest the harvest back into the homestead.</p>
        <div className="store-rows">
          {Object.entries(UPGRADES).map(([key, u]) => {
            const lvl = gs.upgrades?.[key] || 0;
            const maxed = lvl >= u.max;
            const cost = upgradeCost(key, lvl);
            const afford = gs.gold >= cost;
            return (
              <div className="store-row" key={key}>
                <span className="su-icon">{u.icon}</span>
                <span className="su-info">
                  <span className="su-name">{u.name} <small>Lv {lvl}/{u.max}</small></span>
                  <small className="su-desc">{u.desc}</small>
                </span>
                {key === 'sprinkler' && lvl >= 1 ? (
                  <button
                    className={`su-buy toggle ${gs.sprinklerOn ? 'on' : 'off'}`}
                    onClick={() => actions.toggleSprinkler()}
                  >
                    {gs.sprinklerOn ? '💧 On' : 'Off'}
                  </button>
                ) : (
                  <button className="su-buy" disabled={maxed || !afford} onClick={() => actions.buyUpgrade(key)}>
                    {maxed ? 'Owned' : `${cost}g`}
                  </button>
                )}
              </div>
            );
          })}
        </div>
        <div className="modal-total">
          <span>Your gold</span>
          <span className="gold">🪙 {gs.gold}</span>
        </div>
        <div className="modal-actions">
          <button className="continue" onClick={actions.toggleStore}>Done</button>
        </div>
      </div>
    </div>
  );
}

function Sparkline({ data, w = 72, h = 16 }) {
  if (!data || data.length < 2) return <svg className="sparkline" width={w} height={h} />;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pts = data
    .map((v, i) => `${((i / (data.length - 1)) * w).toFixed(1)},${(h - 1 - ((v - min) / range) * (h - 2)).toFixed(1)}`)
    .join(' ');
  const rising = data[data.length - 1] >= data[0];
  return (
    <svg className="sparkline" width={w} height={h}>
      <polyline points={pts} fill="none" stroke={rising ? '#2f8a3a' : '#b5432f'} strokeWidth="1.5" />
    </svg>
  );
}

function SellModal({ gs, actions }) {
  const priceOf = (id) => gs.prices?.[id] ?? CROPS[id].sellPrice;
  const all = Object.entries(CROPS).map(([id, c]) => ({ id, c, count: gs.inventory[id] || 0, price: priceOf(id) }));
  const totalValue = all.reduce((s, x) => s + x.count * x.price, 0);
  const totalItems = all.reduce((s, x) => s + x.count, 0);
  const intake = elevatorIntake(gs.upgrades);
  const sold = gs.soldToday || 0;
  const room = Math.max(0, intake - sold);

  const winter = seasonForDay(gs.day) === 'winter';
  return (
    <div className="modal-backdrop">
      <div className="modal">
        <h2>{winter ? '❄️ Winter Market ❄️' : '🌾 Grain Elevator'}</h2>
        <p className="modal-sub">{winter ? 'Prices climb toward spring — divvy it out.' : 'Prices rise toward harvest, dip at the glut — time it well.'}</p>

        <div className={`intake-meter ${room === 0 ? 'full' : ''}`}>
          <span>🚛 Elevator intake today</span>
          <span className="im-bar"><i style={{ width: `${Math.min(100, (sold / intake) * 100)}%` }} /></span>
          <b>{sold}/{intake} bu</b>
        </div>

        <div className="modal-rows">
          {all.map(({ id, c, count, price }) => {
            const hist = gs.priceHistory?.[id] || [];
            const prev = hist.length >= 2 ? hist[hist.length - 2] : price;
            const trend = price > prev ? '▲' : price < prev ? '▼' : '·';
            const trendCls = price > prev ? 'up' : price < prev ? 'down' : '';
            const vsMean = Math.round(((price - c.sellPrice) / c.sellPrice) * 100);
            const dead = count === 0 || room === 0;
            return (
              <div key={id} className={`modal-row ${count > 0 ? '' : 'empty'}`}>
                <span className="mr-icon">{c.icon}</span>
                <span className="mr-name">
                  {c.name}
                  <Sparkline data={hist} />
                  <small className="mr-shelf">{c.shelfLife >= 999 ? 'keeps forever' : `spoils in ~${c.shelfLife}d`}</small>
                </span>
                <span className="mr-count">×{count}</span>
                <span className={`mr-price ${trendCls}`}>
                  {price}g {trend}
                  <small className={vsMean >= 0 ? 'up' : 'down'}>{vsMean >= 0 ? '+' : ''}{vsMean}%</small>
                </span>
                <span className="mr-sell">
                  <button disabled={dead} onClick={() => actions.sellItem(id, 1)}>1</button>
                  <button disabled={dead || count < 2} onClick={() => actions.sellItem(id, 5)}>5</button>
                  <button disabled={dead} onClick={() => actions.sellItem(id, Infinity)}>Max</button>
                </span>
              </div>
            );
          })}
        </div>

        <div className="modal-total">
          <span>{totalItems} bu stored (worth {totalValue}g at spot)</span>
        </div>

        <div className="contracts">
          <div className="contracts-head">📜 Forward Contracts</div>
          {(gs.contracts || []).map((k) => {
            const have = gs.inventory[k.crop] || 0;
            const dueIn = k.due - gs.day;
            return (
              <div className={`contract active ${have >= k.qty ? 'ready' : ''}`} key={`c${k.id}`}>
                <span>Deliver {k.qty} {CROPS[k.crop].icon} ({have}/{k.qty})</span>
                <span className="ct-meta">{k.qty * k.price}g · {dueIn}d left</span>
              </div>
            );
          })}
          {(gs.contractOffers || []).map((k) => (
            <div className="contract offer" key={`o${k.id}`}>
              <span>{k.qty} {CROPS[k.crop].icon} @ {k.price}g</span>
              <span className="ct-meta">{k.qty * k.price}g · due {k.due - gs.day}d</span>
              <button className="ct-accept" onClick={() => actions.acceptContract(k.id)}>Sign</button>
            </div>
          ))}
        </div>

        <div className="modal-actions">
          <button className="sell-all" disabled={totalItems === 0 || room === 0} onClick={actions.sellAll}>
            💰 Sell Max ({Math.min(room, totalItems)} bu)
          </button>
          <button className="continue" onClick={actions.closeSellModal}>
            {winter ? 'Continue →' : 'Done'}
          </button>
        </div>
      </div>
    </div>
  );
}
