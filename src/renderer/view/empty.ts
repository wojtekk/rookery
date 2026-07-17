// Guided empty state when there's nothing to show (FR-025).

export function renderEmptyState(container: HTMLElement, hasObservedDirectories: boolean, onAddDirectory: () => void): void {
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
  btn.addEventListener('click', onAddDirectory);
  container.appendChild(btn);
}
