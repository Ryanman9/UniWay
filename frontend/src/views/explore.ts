let exploreInitialized = false;

export function initExplore(): void {
  if (exploreInitialized) return;
  exploreInitialized = true;

  const container = document.getElementById("view-explore");
  if (!container) return;

  container.innerHTML = `
    <div class="placeholder-view">
      <h1>Explore Places</h1>
      <p>Category browsing and place details are coming in a later phase.</p>
    </div>
  `;
}
