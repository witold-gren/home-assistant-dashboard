// Themes that come with Home Dashboard, as a start for one's own. They are plain looks, the same as
// a theme in a file: everything in them can be changed in the Look sheet and shared again. They carry
// no pictures, only colours and gradients, so they suit any home.

export const BUILTIN_THEMES = [
  {
    id: "home_dashboard",
    name: "Home Dashboard",
    appearance: { bounce: false },
    backgrounds: {},
  },
  {
    id: "apple_home",
    name: "Apple Home",
    appearance: {
      background_strength: 100,
      page: {
        background_light: "linear-gradient(170deg, #4a9be8 0%, #2c4fa8 45%, #2a1b5e 100%)",
        background_dark: "linear-gradient(170deg, #1d3f7a 0%, #1a1f5a 50%, #120a2e 100%)",
      },
      // Neutral glass: black or white that lets the background through, so the buttons take the colour of
      // whatever page they are on, as in the Home app.
      tiles: {
        opacity: 26,
        radius: 24,
        fill: "icon",
        background: "#000000",
        text: "#ffffff",
        icon: "#ffffff",
        icon_background: "#ffffff26",
      },
      text: { title: "#ffffff", headings: "#ffffff" },
      chips: { background: "#000000", text: "#ffffff", opacity: 26, radius: 24 },
      buttons: { background: "#ffffff", icon: "#ffffff", opacity: 22 },
      badges: { text: "#ffffff", icon: "#ffffff", fill: false },
      // A window shows the page it opened from, blurred and a little darker.
      map: { theme: "dark" },
      sheets: { background: "#000000", text: "#ffffff", controls: "#ffffff26", cards: "#00000000", opacity: 22, blur: 40, scrim: 15 },
      player: { background: "#000000", text: "#ffffff", opacity: 30, blur: 24, radius: 22, paused_minutes: 0 },
      nav: { style: "floating", background: "#ffffff", icon: "#ffffff", active: "#ffffff33", opacity: 20, blur: 24 },
    },
    // The map is dark, so the page around it is too, in both looks.
    backgrounds: {
      map: {
        light: "linear-gradient(170deg, #3b4a6e 0%, #252d45 55%, #1b2033 100%)",
        dark: "linear-gradient(170deg, #222b42 0%, #171c2b 55%, #10131d 100%)",
      },
    },
  },
];
