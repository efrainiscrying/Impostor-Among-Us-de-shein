export default function Bean({ color = "#c51111", size = 64 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" role="img" aria-label="personaje">
      <ellipse cx="50" cy="58" rx="30" ry="34" fill={color} stroke="#00000055" strokeWidth="3" />
      <path d="M 28 40 Q 20 10 46 8 L 60 8 Q 60 20 48 24 Z" fill={color} stroke="#00000055" strokeWidth="3" />
      <ellipse cx="55" cy="42" rx="20" ry="14" fill="#bfe6ff" stroke="#00000055" strokeWidth="3" />
      <ellipse cx="58" cy="42" rx="14" ry="9" fill="#eaf7ff" opacity="0.7" />
      <ellipse cx="35" cy="88" rx="12" ry="6" fill="#00000033" />
    </svg>
  );
}
