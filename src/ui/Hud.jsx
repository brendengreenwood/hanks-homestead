import React from 'react';
import { CROPS, SEASONS, SEASON_ACTIONS, seasonForDay, yearForDay, dayOfSeason, SEASON_LENGTH, storedTotal, UPGRADES, upgradeCost } from '../game/constants.js';
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
                <span className="shop-name">{c.name}</span>
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

      {/* Market + Farm Supply modals */}
      {gs.showSellModal && <SellModal gs={gs} actions={actions} />}
      {gs.showStore && <Store gs={gs} actions={actions} />}
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

  const winter = seasonForDay(gs.day) === 'winter';
  return (
    <div className="modal-backdrop">
      <div className="modal">
        <h2>{winter ? '❄️ Winter Market ❄️' : '🌾 Grain Elevator'}</h2>
        <p className="modal-sub">{winter ? 'Sell your harvest before spring!' : 'Prices rise toward harvest, dip at the glut — time it well.'}</p>

        <div className="modal-rows">
          {all.map(({ id, c, count, price }) => {
            const hist = gs.priceHistory?.[id] || [];
            const prev = hist.length >= 2 ? hist[hist.length - 2] : price;
            const trend = price > prev ? '▲' : price < prev ? '▼' : '·';
            const trendCls = price > prev ? 'up' : price < prev ? 'down' : '';
            const vsMean = Math.round(((price - c.sellPrice) / c.sellPrice) * 100);
            return (
              <button
                key={id}
                className={`modal-row ${count > 0 ? '' : 'empty'}`}
                disabled={count === 0}
                onClick={() => actions.sellItem(id, true)}
              >
                <span className="mr-icon">{c.icon}</span>
                <span className="mr-name">
                  {c.name}
                  <Sparkline data={hist} />
                </span>
                <span className="mr-count">×{count}</span>
                <span className={`mr-price ${trendCls}`}>
                  {price}g {trend}
                  <small className={vsMean >= 0 ? 'up' : 'down'}>{vsMean >= 0 ? '+' : ''}{vsMean}%</small>
                </span>
                <span className="mr-total">{count * price}g</span>
              </button>
            );
          })}
        </div>

        <div className="modal-total">
          <span>{totalItems} items to sell</span>
          <span className="gold">Total: {totalValue}g</span>
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
          <button className="sell-all" disabled={totalItems === 0} onClick={actions.sellAll}>
            💰 Sell All ({totalValue}g)
          </button>
          <button className="continue" onClick={actions.closeSellModal}>
            {winter ? 'Continue →' : 'Done'}
          </button>
        </div>
      </div>
    </div>
  );
}
