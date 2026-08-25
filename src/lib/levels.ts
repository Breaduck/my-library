// 독서 레벨 정의 — 게이미피케이션 카드와 홈화면 위젯이 공유한다(중복 방지).
export const LEVELS = [
  { xp: 0,      title: '독서 새싹',    emoji: '🌱' },
  { xp: 300,    title: '책 친구',      emoji: '📖' },
  { xp: 800,    title: '이야기 수집가', emoji: '📚' },
  { xp: 1600,   title: '책벌레',      emoji: '🐛' },
  { xp: 3000,   title: '활자 애호가',  emoji: '🤓' },
  { xp: 5000,   title: '독서가',      emoji: '🎓' },
  { xp: 8000,   title: '서재의 주인',  emoji: '🏛️' },
  { xp: 12000,  title: '독서 마스터',  emoji: '👑' },
  { xp: 17000,  title: '문장 연금술사', emoji: '⚗️' },
  { xp: 23000,  title: '심야의 탐독가', emoji: '🌙' },
  { xp: 30000,  title: '지식 사냥꾼',  emoji: '🏹' },
  { xp: 38000,  title: '이야기 항해사', emoji: '🧭' },
  { xp: 47000,  title: '서사의 건축가', emoji: '🏗️' },
  { xp: 57000,  title: '활자의 현자',  emoji: '🧙' },
  { xp: 68000,  title: '지식의 수호자', emoji: '🛡️' },
  { xp: 80000,  title: '문학의 대가',  emoji: '🎩' },
  { xp: 95000,  title: '이야기의 지휘자', emoji: '🎼' },
  { xp: 112000, title: '활자 우주인',  emoji: '🚀' },
  { xp: 135000, title: '독서의 전설',  emoji: '🐉' },
  { xp: 160000, title: '살아있는 도서관', emoji: '🌌' },
];

export function levelFromXp(xp: number) {
  const idx = LEVELS.reduce((acc, lv, i) => (xp >= lv.xp ? i : acc), 0);
  return { idx, level: idx + 1, title: LEVELS[idx].title, emoji: LEVELS[idx].emoji };
}
