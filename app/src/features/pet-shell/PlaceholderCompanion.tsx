export function PlaceholderCompanion() {
  return (
    <svg className="placeholder-companion" viewBox="0 0 180 280" role="img" aria-label="FoeDesk 占位人物">
      <defs>
        <linearGradient id="coat" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#8bb7a0" />
          <stop offset="1" stopColor="#4f7b69" />
        </linearGradient>
        <radialGradient id="face" cx="48%" cy="32%" r="70%">
          <stop offset="0" stopColor="#fff0dd" />
          <stop offset="1" stopColor="#e6bd9c" />
        </radialGradient>
      </defs>
      <ellipse className="placeholder-companion__shadow" cx="92" cy="267" rx="56" ry="9" />
      <path fill="url(#coat)" d="M49 133c12-18 70-21 84 2 11 18 19 82 19 125H30c1-44 7-108 19-127Z" />
      <path fill="#38594d" d="M51 176c15 11 64 12 81-1l7 85H42l9-84Z" opacity=".38" />
      <path fill="url(#face)" d="M48 71c0-37 18-58 45-58 29 0 48 22 48 59 0 40-22 73-48 73S48 111 48 71Z" />
      <path fill="#35483f" d="M48 75c-5-38 13-67 45-67 30 0 50 27 47 65-7-16-15-24-26-30-13 17-35 27-66 32Z" />
      <path fill="#35483f" d="M48 65c-9 12-8 48 3 62l8-51-11-11Zm91-2c10 14 9 48-2 64l-7-53 9-11Z" />
      <ellipse cx="76" cy="91" rx="4" ry="5" fill="#3d4b45" />
      <ellipse cx="112" cy="91" rx="4" ry="5" fill="#3d4b45" />
      <path d="M86 114c5 4 11 4 16 0" fill="none" stroke="#a46762" strokeWidth="3" strokeLinecap="round" />
      <circle cx="60" cy="107" r="8" fill="#e7998f" opacity=".22" />
      <circle cx="127" cy="107" r="8" fill="#e7998f" opacity=".22" />
      <path d="M67 144c14 13 38 13 52 0l-8 39H77l-10-39Z" fill="#f2e9d9" />
      <path d="M55 153 30 223M128 153l24 70" fill="none" stroke="#6c9b84" strokeWidth="23" strokeLinecap="round" />
      <path d="M69 258v-61m47 61v-61" fill="none" stroke="#415b51" strokeWidth="24" strokeLinecap="round" />
      <path d="M56 261h30m15 0h31" fill="none" stroke="#30483e" strokeWidth="14" strokeLinecap="round" />
      <path className="placeholder-companion__spark" d="m145 35 3 8 8 3-8 3-3 8-3-8-8-3 8-3 3-8Z" fill="#e0b85d" />
    </svg>
  );
}

