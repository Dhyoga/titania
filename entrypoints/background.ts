export default defineBackground(() => {
  // Clicking the toolbar icon opens the side panel.
  browser.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch((err: unknown) => console.error('sidePanel.setPanelBehavior failed', err))
})
