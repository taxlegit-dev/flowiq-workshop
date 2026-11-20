// Small line-icon set (24px grid, 1.6 stroke) used across the shell and cards.
const P = {
  grid: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z",
  inbox: "M4 13l2.5-7h11L20 13M4 13v6h16v-6M4 13h4.5l1.5 2.5h4l1.5-2.5H20",
  file: "M7 3h7l5 5v13H7zM14 3v5h5",
  download: "M12 4v11m0 0l-4.5-4.5M12 15l4.5-4.5M5 19h14",
  sliders: "M5 7h9m4 0h1M5 17h3m4 0h7M15 5v4M9 15v4",
  reset: "M5 12a7 7 0 1 0 2-5M5 4v4h4",
  logout: "M14 4h5v16h-5M10 12h10M10 12l3.5-3.5M10 12l3.5 3.5",
  alert: "M12 4l9 16H3zM12 10v4M12 17v.5",
  clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2",
  wallet: "M4 7h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4zM4 7l11-3v3M16 13.5h.5",
  chart: "M4 20V10M10 20V4M16 20v-7M22 20H2",
  check: "M5 12.5l4.5 4.5L19 7",
  layers: "M12 3l9 5-9 5-9-5zM3 13l9 5 9-5",
  bolt: "M13 3L5 13h6l-1 8 8-10h-6z",
  table: "M4 5h16v14H4zM4 10h16M10 10v9",
  chevron: "M8 10l4 4 4-4",
  right: "M10 7l5 5-5 5",
  sync: "M20 12a8 8 0 0 1-14 5.3M4 12a8 8 0 0 1 14-5.3M18 3v4h-4M6 21v-4h4",
  building: "M5 21V5l7-2v18M12 7h7v14M8 8v.5M8 12v.5M8 16v.5M15.5 11v.5M15.5 15v.5",
  trend: "M4 16l5-5 4 4 7-7M15 8h5v5",
  shield: "M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6z",
};
export default function Icon({ name, size = 16, className = "" }) {
  return (
    <svg className={`ic ${className}`} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={P[name] || P.grid} />
    </svg>
  );
}
