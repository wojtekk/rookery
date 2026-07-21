// Flat indeterminate loader render (FR-002). See contracts/loadstate.md §B.

export function setLoaderVisible(container: HTMLElement, visible: boolean, label?: string): void {
  container.hidden = !visible;
  if (visible && container.childElementCount === 0) {
    const labelEl = document.createElement('div');
    labelEl.className = 'loader-label';
    labelEl.setAttribute('role', 'status');
    container.appendChild(labelEl);

    const dots = document.createElement('div');
    dots.className = 'loader-dots';
    for (let i = 0; i < 3; i++) {
      const dot = document.createElement('div');
      dot.className = 'loader-dot';
      dots.appendChild(dot);
    }
    container.appendChild(dots);
  }
  if (visible && label !== undefined) {
    const labelEl = container.querySelector('.loader-label');
    if (labelEl) labelEl.textContent = label;
  }
}
