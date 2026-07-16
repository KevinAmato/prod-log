import { useEffect } from 'react';

// Long-press drag & drop for touch. Mouse users keep native HTML5 dnd; this
// hook only engages for touch/pen pointers.
//
// Interaction contract:
//   - Hold a card ~320 ms without moving (>10 px cancels — that's a scroll)
//   - Haptic tick + the card lifts into a fixed "ghost" that follows the finger
//   - Hovering a card shows an accent insertion line (above/below midpoint);
//     hovering a column's empty space targets its end
//   - Dragging to the screen edge auto-scrolls the board to the next column;
//     top/bottom edges of a column auto-scroll its list
//
// DOM contract (data attributes, set by Board/Column/TaskCard):
//   [data-board]                  the horizontal scroller
//   [data-col-drop="<colId>"]     each column's card list
//   [data-card-id][data-index]    each card root
const HOLD_MS = 320;
const SLOP_PX = 10;
const EDGE_PX = 48;

export default function useTouchDrag(ref, { cardId, title, index, colId, onDrop }) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let timer = null;
    let active = false;
    let ghost = null;
    let raf = null;
    let start = null; // {x, y, rect}
    let last = null; // {x, y}
    let target = null; // {colId, slot, listEl}

    const preventScroll = (e) => {
      if (active) e.preventDefault();
    };

    const clearIndicators = () => {
      document
        .querySelectorAll('.drop-above, .drop-below, .drop-into')
        .forEach((n) => n.classList.remove('drop-above', 'drop-below', 'drop-into'));
    };

    const cleanup = () => {
      clearTimeout(timer);
      timer = null;
      cancelAnimationFrame(raf);
      const board = document.querySelector('[data-board]');
      if (board) board.style.scrollSnapType = '';
      document.removeEventListener('touchmove', preventScroll);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
      clearIndicators();
      ghost?.remove();
      ghost = null;
      el.style.opacity = '';
      active = false;
      start = null;
      last = null;
      target = null;
    };

    const activate = () => {
      active = true;
      navigator.vibrate?.(12);
      el.style.opacity = '0.35';
      // Scroll-snap would fight the edge auto-scroll — suspend it for the drag.
      const board = document.querySelector('[data-board]');
      if (board) board.style.scrollSnapType = 'none';
      document.addEventListener('touchmove', preventScroll, { passive: false });
      ghost = document.createElement('div');
      ghost.className = 'drag-ghost';
      ghost.textContent = title;
      ghost.style.width = `${start.rect.width}px`;
      ghost.style.left = `${start.rect.left}px`;
      ghost.style.top = `${start.rect.top}px`;
      document.body.appendChild(ghost);
      scrollLoop();
    };

    // Edge auto-scroll: horizontal on the board (reach the next column),
    // vertical on the hovered column's list.
    const scrollLoop = () => {
      raf = requestAnimationFrame(() => {
        if (!active) return;
        if (last) {
          const board = document.querySelector('[data-board]');
          if (board) {
            if (last.x > window.innerWidth - EDGE_PX) board.scrollLeft += 10;
            else if (last.x < EDGE_PX) board.scrollLeft -= 10;
          }
          const listEl = target?.listEl;
          if (listEl) {
            const r = listEl.getBoundingClientRect();
            if (last.y > r.bottom - EDGE_PX) listEl.scrollTop += 8;
            else if (last.y < r.top + EDGE_PX) listEl.scrollTop -= 8;
          }
        }
        scrollLoop();
      });
    };

    const hitTest = (x, y) => {
      clearIndicators();
      target = null;
      const under = document.elementFromPoint(x, y); // ghost is pointer-events:none
      if (!under) return;
      const listEl = under.closest('[data-col-drop]');
      const cardEl = under.closest('[data-card-id]');
      if (cardEl && cardEl !== el && listEl) {
        const r = cardEl.getBoundingClientRect();
        const before = y < r.top + r.height / 2;
        let slot = Number(cardEl.dataset.index) + (before ? 0 : 1);
        // moveCard indexes among the column's cards EXCLUDING the moving one.
        if (listEl.dataset.colDrop === colId && slot > index) slot -= 1;
        cardEl.classList.add(before ? 'drop-above' : 'drop-below');
        target = { colId: listEl.dataset.colDrop, slot, listEl };
      } else if (listEl) {
        listEl.classList.add('drop-into');
        target = { colId: listEl.dataset.colDrop, slot: Infinity, listEl };
      }
    };

    const onMove = (e) => {
      last = { x: e.clientX, y: e.clientY };
      if (!active) {
        if (
          start &&
          Math.hypot(e.clientX - start.x, e.clientY - start.y) > SLOP_PX
        ) {
          cleanup(); // finger is scrolling, not holding
        }
        return;
      }
      ghost.style.transform = `translate(${e.clientX - start.x}px, ${e.clientY - start.y}px)`;
      hitTest(e.clientX, e.clientY);
    };

    const onUp = () => {
      if (active && target && !(target.colId === colId && target.slot === index)) {
        onDrop(target.colId, target.slot);
      }
      cleanup();
    };

    const onCancel = () => cleanup();

    const onDown = (e) => {
      if (e.pointerType === 'mouse') return; // mouse uses HTML5 dnd
      if (e.target.closest('button, input, textarea, a')) return;
      start = { x: e.clientX, y: e.clientY, rect: el.getBoundingClientRect() };
      last = { x: e.clientX, y: e.clientY };
      timer = setTimeout(activate, HOLD_MS);
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onCancel);
    };

    el.addEventListener('pointerdown', onDown);
    return () => {
      el.removeEventListener('pointerdown', onDown);
      cleanup();
    };
  }, [ref, cardId, title, index, colId, onDrop]);
}
