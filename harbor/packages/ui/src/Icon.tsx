const PATHS = {
  bell: 'M6 8a6 6 0 1 1 12 0c0 6 2 7 2 8H4c0-1 2-2 2-8Zm4 11a2 2 0 0 0 4 0',
  search: 'M11 4a7 7 0 1 1 0 14 7 7 0 0 1 0-14Zm5 12 4 4',
  plus: 'M12 5v14M5 12h14',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  close: 'M6 6l12 12M18 6 6 18',
  grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  chevronDown: 'M6 9l6 6 6-6',
  user: 'M12 4a4 4 0 1 1 0 8 4 4 0 0 1 0-8ZM4 20c1-4 4-6 8-6s7 2 8 6',
  lock: 'M7 11V8a5 5 0 0 1 10 0v3M5 11h14v9H5z',
  warning: 'M12 4 2 20h20L12 4Zm0 6v5m0 3h.01',
  info: 'M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18Zm0 8v5m0-8h.01',
  check: 'M5 12l5 5 9-10',
  reload: 'M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5',
  menu: 'M4 6h16M4 12h16M4 18h16',
  log: 'M5 4h14v16H5zM8 8h8M8 12h8M8 16h5',
  download: 'M12 4v11m0 0-4-4m4 4 4-4M5 20h14',
  upload: 'M12 16V5m0 0-4 4m4-4 4 4M5 20h14',
} as const

export type IconName = keyof typeof PATHS

export function Icon({ name, size = 16 }: { name: IconName; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d={PATHS[name]} />
    </svg>
  )
}
