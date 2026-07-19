// Guided empty state when there's nothing to show (FR-025).

export function renderEmptyState(
  container: HTMLElement,
  hasObservedDirectories: boolean,
  onAddDirectory: () => void,
  locked = false,
): void {
  container.innerHTML = '';

  const heading = document.createElement('div');
  heading.className = 'empty-heading';
  heading.textContent = hasObservedDirectories ? 'No repositories found' : 'Nothing is being observed yet';
  container.appendChild(heading);

  const body = document.createElement('div');
  body.className = 'empty-body';
  body.textContent = hasObservedDirectories
    ? 'None of the observed directories contain a git repository.'
    : 'Add a directory to see the git repositories cloned inside it.';
  container.appendChild(body);

  const btn = document.createElement('button');
  btn.className = 'btn';
  btn.textContent = '+ Add directory…';
  // FR-011: this opens Settings, so it must respect the same long-operation lock as the toolbar's
  // Settings button — native disabled, no colour change (FR-003).
  btn.disabled = locked;
  btn.addEventListener('click', onAddDirectory);
  container.appendChild(btn);
}
