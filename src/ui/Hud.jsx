import React from 'react';
import { CROPS, SEASONS, SEASON_ACTIONS, seasonForDay, yearForDay, dayOfSeason, SEASON_LENGTH } from '../game/constants.js';
import './hud.css';

export default function Hud({ gs, actions }) {
  const season = seasonForDay(gs.day);
  const sd = SEASONS[season];
  const actionList = SEASON_ACTIONS[season];
  const cropEntries = Object.entries(CROPS);

  const harvested = cropEntries.map(([id, c]) => ({ id, c, count: gs.inventory[id] || 0 }));
  const totalHarvested = harvested.reduce((s, h) => s + h.count, 0);
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
      {/* Title */}
      <div className="hud-title">🌾 Hank's Homestead</div>

      {/* Season (top-left) */}
      <div className="season-chip">
        <span className="season-icon">{sd.icon}</span>
        <span className="season-name">{sd.name}</span>
      </div>

      {/* Top-right controls */}
      <div className="topright">
        <button className={`shop-btn ${gs.showShop ? 'active' : ''}`} onClick={actions.toggleShop}>
          🏪 Shop
        </button>
        <button className="icon-btn" title="Reset game" onClick={actions.resetGame}>↺</button>
      </div>

      {/* Shop panel */}
      {gs.showShop && (
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
        </div>
      )}

      {/* Inventory (left-center) */}
      <div className="inventory">
        <div className="inv-head">🎒 {totalHarvested}</div>
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
                  <span className="gold">{c.sellPrice}g</span>
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

      {/* Winter sell modal */}
      {gs.showSellModal && <SellModal gs={gs} actions={actions} />}
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

function SellModal({ gs, actions }) {
  const all = Object.entries(CROPS).map(([id, c]) => ({ id, c, count: gs.inventory[id] || 0 }));
  const totalValue = all.reduce((s, x) => s + x.count * x.c.sellPrice, 0);
  const totalItems = all.reduce((s, x) => s + x.count, 0);

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <h2>❄️ Winter Market ❄️</h2>
        <p className="modal-sub">Sell your harvest before spring!</p>

        <div className="modal-rows">
          {all.map(({ id, c, count }) => (
            <button
              key={id}
              className={`modal-row ${count > 0 ? '' : 'empty'}`}
              disabled={count === 0}
              onClick={() => actions.sellItem(id, true)}
            >
              <span className="mr-icon">{c.icon}</span>
              <span className="mr-name">{c.name}</span>
              <span className="mr-count">×{count}</span>
              <span className="mr-each">{c.sellPrice}g each</span>
              <span className="mr-total">{count * c.sellPrice}g</span>
            </button>
          ))}
        </div>

        <div className="modal-total">
          <span>{totalItems} items to sell</span>
          <span className="gold">Total: {totalValue}g</span>
        </div>

        <div className="modal-actions">
          <button className="sell-all" disabled={totalItems === 0} onClick={actions.sellAll}>
            💰 Sell All ({totalValue}g)
          </button>
          <button className="continue" onClick={actions.closeSellModal}>
            Continue →
          </button>
        </div>
      </div>
    </div>
  );
}
