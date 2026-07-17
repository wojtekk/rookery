// Flat indeterminate loader render (FR-002). See contracts/loadstate.md §B.

export function setLoaderVisible(container: HTMLElement, visible: boolean): void {
  container.hidden = !visible;
  if (visible && container.childElementCount === 0) {
    for (let i = 0; i < 3; i++) {
      const dot = document.createElement('div');
      dot.className = 'loader-dot';
      container.appendChild(dot);
    }
  }
}
