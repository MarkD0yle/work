import { cx, focus } from "../patterns/tokens";

/** 16×16 stroke paths for the filter's icons. */
export const ICON = {
  copy: "M5 5h8v8H5zM3 11V3h8",
  trash: "M3 4h10M6 4V2.5h4V4M4.5 4l.7 9.5h5.6l.7-9.5",
  chevron: "M4 6l4 4 4-4",
  plus: "M8 3v10M3 8h10",
  search: "M7 12A5 5 0 1 0 7 2a5 5 0 0 0 0 10zM11 11l3 3",
  x: "M4 4l8 8M12 4l-8 8",
  up: "M8 13V3M4 7l4-4 4 4",
  down: "M8 3v10M4 9l4 4 4-4",
  wrap: "M5 3H3v10h2M11 3h2v10h-2M6.5 8h3",
  unwrap: "M3 3h2M3 13h2M3 3v10M13 3h-2M13 13h-2M13 3v10",
  grip: "M6 4h.01M10 4h.01M6 8h.01M10 8h.01M6 12h.01M10 12h.01",
  undo: "M4 6h6a3 3 0 0 1 0 6H7M4 6l3-3M4 6l3 3",
  redo: "M12 6H6a3 3 0 0 0 0 6h3M12 6L9 3M12 6L9 9",
  filter: "M2 3h12l-4.5 5.5V13l-3 1.5V8.5z",
  logic: "M3 4h4M3 8h4M3 12h4M9 4h4v8H9M9 8h4",
  star: "M8 2l1.8 3.8 4.2.5-3.1 2.9.8 4.1L8 11.3 4.3 13.3l.8-4.1L2 6.3l4.2-.5z",
  warn: "M8 2l6.5 11.5h-13zM8 6.5v3M8 11.5h.01",
};

export const iconBtn = cx(
  "inline-flex h-6 w-6 shrink-0 items-center justify-center text-neutral-400 hover:bg-neutral-100 hover:text-neutral-900 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent",
  focus,
);
