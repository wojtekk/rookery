// Expandable header search affordance (016 contracts/search-filter.md §2, R7).

import { iconSvg } from './icons/catalog.js';

export interface SearchState {
  query: string;
  expanded: boolean;
  busy: boolean;
}

export interface SearchHandlers {
  onQueryChange: (raw: string) => void;
  onToggleExpanded: (expanded: boolean) => void;
  onBlur: () => void;
  onFocus: () => void;
}

export function renderSearch(container: HTMLElement, state: SearchState, handlers: SearchHandlers): void {
  // render() re-creates this container's contents from scratch on every call (matches the rest of
  // the renderer). Without this check, a re-render triggered by something unrelated (e.g. a Pull all
  // that finishes while the user is mid-typing) would silently steal focus away from the input.
  const hadFocus = container.contains(document.activeElement);
  container.innerHTML = '';

  if (!state.expanded) {
    const btn = document.createElement('button');
    btn.className = 'search-ico';
    btn.innerHTML = iconSvg('search'); // bundled static SVG (no user input) — safe
    btn.setAttribute('aria-label', 'Search repositories');
    btn.disabled = state.busy; // FR-011: blocked during a long operation, cursor-only (see styles.css)
    btn.setAttribute('aria-disabled', String(state.busy));
    if (!state.busy) btn.addEventListener('click', () => handlers.onToggleExpanded(true));
    container.appendChild(btn);
    return;
  }

  const box = document.createElement('div');
  box.className = `search-box${state.busy ? ' busy' : ''}`;

  const icon = document.createElement('span');
  icon.className = 'search-box-ico';
  icon.innerHTML = iconSvg('search'); // bundled static SVG (no user input) — safe
  box.appendChild(icon);

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'search-input';
  input.value = state.query;
  input.placeholder = 'Search repositories…';
  input.setAttribute('aria-label', 'Search repositories');
  // readOnly rather than disabled (research R5): disabled inputs grey out by default in most
  // browsers; readOnly keeps full colour while still blocking edits, so no CSS fight is needed.
  input.readOnly = state.busy;
  input.setAttribute('aria-disabled', String(state.busy));
  box.appendChild(input);

  const clearBtn = document.createElement('button');
  clearBtn.className = 'search-clear-ico';
  clearBtn.innerHTML = iconSvg('x'); // bundled static SVG (no user input) — safe
  clearBtn.setAttribute('aria-label', 'Clear search');
  clearBtn.hidden = state.query === '';
  clearBtn.disabled = state.busy;
  box.appendChild(clearBtn);

  // Clears immediately (bypassing the caller's debounce, contracts/search-filter.md §2). The
  // onQueryChange('') call re-renders synchronously (renderer.ts), which replaces this whole
  // subtree and refocuses the new input via the hadFocus check above — no need to focus here too.
  const clear = (): void => {
    input.value = '';
    clearBtn.hidden = true;
    handlers.onQueryChange('');
  };

  if (!state.busy) {
    input.addEventListener('input', () => {
      clearBtn.hidden = input.value === '';
      handlers.onQueryChange(input.value);
    });
    input.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      if (input.value === '') handlers.onToggleExpanded(false);
      else clear();
    });
    input.addEventListener('blur', handlers.onBlur);
    input.addEventListener('focus', handlers.onFocus);
    clearBtn.addEventListener('click', clear);
  }

  container.appendChild(box);
  if (hadFocus && !state.busy) input.focus();
}
