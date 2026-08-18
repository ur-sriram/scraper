interface IconProps {
  name: string;
  className?: string;
  strokeWidth?: number;
}

export function Icon({ name, className = "w-4 h-4", strokeWidth = 1.7 }: IconProps) {
  const paths: Record<string, React.ReactNode> = {
    fingerprint: (
      <>
        <path d="M12 4.5c-4.1 0-7 3.2-7 7.4 0 2.6.6 4.8 1.6 6.6" />
        <path d="M12 7.5c-2.4 0-4.2 2-4.2 4.6 0 2.2.4 4.2 1.2 5.9" />
        <path d="M12 10.6a1.8 1.8 0 0 0-1.8 1.9c0 2 .3 3.8 1 5.4" />
        <path d="M12 4.5c4.1 0 7 3.2 7 7.4 0 1.2-.1 2.3-.3 3.3" />
        <path d="M12 7.5c2.4 0 4.2 2 4.2 4.6 0 1.5-.2 2.9-.5 4.2" />
        <path d="M12 10.6c1 0 1.8.9 1.8 1.9 0 1.7-.2 3.2-.6 4.6" />
      </>
    ),
    briefcase: (
      <>
        <path d="M4 8.5h16v10a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5v-10Z" />
        <path d="M9 8.5V6.8A1.8 1.8 0 0 1 10.8 5h2.4A1.8 1.8 0 0 1 15 6.8v1.7" />
        <path d="M4 13h6m4 0h6" />
        <path d="M10.5 13v1.6h3V13" />
      </>
    ),
    chip: (
      <>
        <rect x="7" y="7" width="10" height="10" rx="1.5" />
        <rect x="10" y="10" width="4" height="4" />
        <path d="M9 7V4m6 3V4M9 20v-3m6 3v-3M7 9H4m3 6H4m16-6h-3m3 6h-3" />
      </>
    ),
    cap: (
      <>
        <path d="M12 5 2.5 9.5 12 14l9.5-4.5L12 5Z" />
        <path d="M6 11.5v4c0 1.4 2.7 2.8 6 2.8s6-1.4 6-2.8v-4" />
        <path d="M21 10v5" />
      </>
    ),
    rocket: (
      <>
        <path d="M12 3.5c3.2 1.2 5 4.3 5 8l-2.2 3.5H9.2L7 11.5c0-3.7 1.8-6.8 5-8Z" />
        <circle cx="12" cy="9.5" r="1.6" />
        <path d="M9.2 15 7 18.5M14.8 15l2.2 3.5M12 15v5.5" />
      </>
    ),
    trophy: (
      <>
        <path d="M8 4.5h8v5a4 4 0 0 1-8 0v-5Z" />
        <path d="M8 6H4.8v1.7A3.2 3.2 0 0 0 8 10.9M16 6h3.2v1.7a3.2 3.2 0 0 1-3.2 3.2" />
        <path d="M12 13.5v3M8.8 19.5h6.4M10 16.5h4v3h-4z" />
      </>
    ),
    ribbon: (
      <>
        <circle cx="12" cy="9" r="4.5" />
        <circle cx="12" cy="9" r="1.8" />
        <path d="m9.5 12.8-2 6 4.5-2.6 4.5 2.6-2-6" />
      </>
    ),
    radar: (
      <>
        <path d="M12 3.5a8.5 8.5 0 1 1-8.5 8.5" />
        <path d="M12 7a5 5 0 1 1-5 5" />
        <path d="M12 12 6 6.2" />
        <circle cx="12" cy="12" r="0.9" fill="currentColor" />
      </>
    ),
    nodes: (
      <>
        <circle cx="6" cy="6.5" r="2.2" />
        <circle cx="18" cy="7.5" r="2.2" />
        <circle cx="12" cy="17.5" r="2.2" />
        <path d="m7.8 7.8 8-0.6M7 8.5l3.8 7.2m4.4-.4-2.7-6.6" />
      </>
    ),
    pen: (
      <>
        <path d="m14.5 5 4.5 4.5L8.5 20H4v-4.5L14.5 5Z" />
        <path d="m12.5 7 4.5 4.5M4 20l1.6-4.4" />
      </>
    ),
    orbit: (
      <>
        <circle cx="12" cy="12" r="3.2" />
        <path d="M18.5 8.6c1.5 2.6.6 6-2.2 8.4-3.2 2.8-7.6 3.2-9.8.7s-1.4-6.8 1.8-9.6c2.6-2.3 5.9-2.8 8.2-1.3" />
        <circle cx="18.8" cy="6.5" r="1.1" fill="currentColor" stroke="none" />
      </>
    ),
    run: <path d="M8 5.5v13l10-6.5-10-6.5Z" />,
    stop: <rect x="7" y="7" width="10" height="10" rx="1" />,
    download: (
      <>
        <path d="M12 4v10m0 0 4-4m-4 4-4-4" />
        <path d="M5 15.5v3A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5v-3" />
      </>
    ),
    copy: (
      <>
        <rect x="8.5" y="8.5" width="11" height="11" rx="1.5" />
        <path d="M5.5 14.5A1.5 1.5 0 0 1 4 13V5.5A1.5 1.5 0 0 1 5.5 4H13a1.5 1.5 0 0 1 1.5 1.5" />
      </>
    ),
    search: (
      <>
        <circle cx="10.5" cy="10.5" r="5.5" />
        <path d="m15 15 4.5 4.5" />
      </>
    ),
    terminal: (
      <>
        <rect x="3.5" y="5" width="17" height="14" rx="1.8" />
        <path d="m7 9.5 3 2.5-3 2.5M12.5 15H17" />
      </>
    ),
    check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
    warn: (
      <>
        <path d="M12 4 2.8 19.5h18.4L12 4Z" />
        <path d="M12 10v4.2m0 2.6v.4" />
      </>
    ),
    cross: <path d="m6 6 12 12M18 6 6 18" />,
    clock: (
      <>
        <circle cx="12" cy="12" r="8" />
        <path d="M12 7.5V12l3 2" />
      </>
    ),
    layers: (
      <>
        <path d="m12 3.5 8.5 4.5L12 12.5 3.5 8 12 3.5Z" />
        <path d="m4.5 12 7.5 4 7.5-4M4.5 16l7.5 4 7.5-4" />
      </>
    ),
    bolt: <path d="M13 3 5 13.5h5L10.5 21l8-10.5h-5.5L13 3Z" />,
    arrow: <path d="M5 12h13m0 0-4.5-4.5M18 12l-4.5 4.5" />,
    link: (
      <>
        <path d="M10 14a4 4 0 0 0 6 .5l3-3a4 4 0 0 0-5.6-5.6l-1.7 1.7" />
        <path d="M14 10a4 4 0 0 0-6-.5l-3 3a4 4 0 0 0 5.6 5.6l1.7-1.7" />
      </>
    ),
    shield: (
      <>
        <path d="M12 3.5 5 6v6c0 4.5 3 7.5 7 8.5 4-1 7-4 7-8.5V6l-7-2.5Z" />
        <path d="m9 11.8 2.2 2.2 4-4.2" />
      </>
    ),
    linkedin: (
      <>
        <rect x="4" y="4" width="16" height="16" rx="2.5" />
        <path d="M8 10.5V16M8 7.6v.2M11.5 16v-3.2c0-1.3.9-2.3 2.2-2.3s2.3 1 2.3 2.3V16" />
      </>
    ),
    github: (
      <>
        <path d="M12 3.5a8.5 8.5 0 0 0-2.7 16.6c.4.1.6-.2.6-.4v-1.5c-2.4.5-2.9-1.2-2.9-1.2-.4-1-1-1.3-1-1.3-.8-.6.1-.6.1-.6.9.1 1.4 1 1.4 1 .8 1.4 2.1 1 2.6.7.1-.6.3-1 .6-1.2-1.9-.2-3.9-1-3.9-4.3 0-1 .3-1.7.9-2.3-.1-.3-.4-1.1.1-2.3 0 0 .7-.2 2.4.9a8.3 8.3 0 0 1 4.3 0c1.7-1.1 2.4-.9 2.4-.9.5 1.2.2 2 .1 2.3.6.6.9 1.4.9 2.3 0 3.4-2 4.1-3.9 4.3.3.3.6.8.6 1.6v2.3c0 .2.2.5.6.4A8.5 8.5 0 0 0 12 3.5Z" />
      </>
    ),
    leetcode: (
      <>
        <path d="M13.5 5.2 7.2 11.6a2.3 2.3 0 0 0 0 3.3l3.4 3.4a2.3 2.3 0 0 0 3.3 0l1.1-1.1" />
        <path d="M9.8 13.6h7.4a1.7 1.7 0 0 0 1.2-2.9l-2-2" />
      </>
    ),
    user: (
      <>
        <circle cx="12" cy="8.2" r="3.6" />
        <path d="M5 19.5c.9-3.4 3.6-5.3 7-5.3s6.1 1.9 7 5.3" />
      </>
    ),
    lock: (
      <>
        <rect x="6" y="10.5" width="12" height="9" rx="1.8" />
        <path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5M12 14v2.2" />
      </>
    ),
    refresh: (
      <>
        <path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3L19.5 8.9" />
        <path d="M19.5 4.5v4.4h-4.4" />
      </>
    ),
    globe: (
      <>
        <circle cx="12" cy="12" r="8" />
        <path d="M4 12h16M12 4c2.5 2.2 3.8 5 3.8 8S14.5 17.8 12 20c-2.5-2.2-3.8-5-3.8-8S9.5 6.2 12 4Z" />
      </>
    ),
    pulse: <path d="M3.5 12h4l2.5-6 4 12 2.5-6h4" />,
  };

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {paths[name] ?? <circle cx="12" cy="12" r="8" />}
    </svg>
  );
}

export function LogoMark({ className = "w-7 h-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <rect width="32" height="32" rx="7" fill="#0d1526" stroke="#2b4068" />
      <path d="M7 9h18l-7 8v6l-4 2v-8L7 9z" fill="none" stroke="#3ecf8e" strokeWidth="2.2" strokeLinejoin="round" />
      <circle cx="23" cy="8.6" r="1.6" fill="#f5b84b" />
    </svg>
  );
}
