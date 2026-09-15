let profileInitialized = false;

export function initProfile(): void {
  if (profileInitialized) return;
  profileInitialized = true;

  const container = document.getElementById("view-profile");
  if (!container) return;

  container.innerHTML = `
    <div class="placeholder-view">
      <h1>Profile</h1>
      <p>Favorites and settings are coming in a later phase.</p>
    </div>
  `;
}
