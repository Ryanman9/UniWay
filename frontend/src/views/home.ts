let homeInitialized = false;

export function initHome(): void {
  if (homeInitialized) return;
  homeInitialized = true;

  const container = document.getElementById("view-home");
  if (!container) return;

  container.innerHTML = `
    <div class="placeholder-view">
      <h1>Welcome to UniWay</h1>
      <p>Your dashboard is coming soon — recent visits, favorites, and quick shortcuts will show up here.</p>
    </div>
  `;
}
