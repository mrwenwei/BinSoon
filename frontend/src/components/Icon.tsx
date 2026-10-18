const paths = {
  map: "m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6Zm6-3v15m6-12v15",
  arrow: "M5 12h14m-6-6 6 6-6 6",
  back: "M19 12H5m6-6-6 6 6 6",
  search: "M21 21l-5-5m2-6a7 7 0 1 1-14 0 7 7 0 0 1 14 0",
  pin: "M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Zm-5 0a3 3 0 1 1-6 0 3 3 0 0 1 6 0",
  star: "m12 3 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1 3-6Z",
  heart: "M20 5c-3-3-6-1-8 1-2-2-5-4-8-1-4 4 1 9 8 15 7-6 12-11 8-15Z",
  camera: "M3 7h5l2-3h4l2 3h5v14H3V7Zm13 6a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
  check: "m5 12 4 4L19 6",
  user: "M20 21v-3a8 8 0 0 0-16 0v3m12-15a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
  report: "M12 3 2 21h20L12 3Zm0 6v5m0 3v1",
  gift: "M3 8h18v5H3V8Zm2 5v8h14v-8M12 8v13m0-13C4 8 5 1 9 3l3 5Zm0 0c8 0 7-7 3-5l-3 5Z",
  close: "m6 6 12 12M18 6 6 18",
  clock: "M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0M12 6v6l4 2",
};
export function Icon({ name }: { name: keyof typeof paths }) {
  return (
    <svg
      className="icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name]} />
    </svg>
  );
}
