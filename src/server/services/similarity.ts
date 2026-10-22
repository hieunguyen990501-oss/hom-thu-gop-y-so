// Gợi ý lĩnh vực theo từ khóa và phát hiện góp ý tương tự — xử lý hoàn toàn cục bộ,
// không gửi nội dung ra dịch vụ bên ngoài. Kết quả chỉ là gợi ý, cán bộ phải xác nhận.

export function stripDiacritics(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();
}

const STOPWORDS = new Set(
  "va la cua cac co cho trong khi de nhung duoc mot nay khong voi da den tai thi ra ve nhu hay cung tu theo can se dang rat nen boi vi ma do o the cai bi lai con tren duoi sau truoc vao ban toi chung em anh".split(" "),
);

export function tokenize(s: string): string[] {
  return stripDiacritics(s)
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOPWORDS.has(w));
}

function shingles(tokens: string[]): Set<string> {
  const set = new Set<string>();
  for (const t of tokens) set.add(t);
  for (let i = 0; i + 1 < tokens.length; i++) set.add(tokens[i] + "_" + tokens[i + 1]);
  return set;
}

export function similarity(a: string, b: string): number {
  const A = shingles(tokenize(a));
  const B = shingles(tokenize(b));
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  return inter / (A.size + B.size - inter);
}

export interface CategoryRule {
  id: string;
  name: string;
  keywords: string;
}

// Trả về lĩnh vực có nhiều từ khóa khớp nhất (cụm từ khóa được so khớp không dấu).
export function suggestCategory(text: string, categories: CategoryRule[]): { id: string; score: number } | null {
  const hay = " " + stripDiacritics(text).replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ") + " ";
  let best: { id: string; score: number } | null = null;
  for (const c of categories) {
    const kws = c.keywords
      .split(",")
      .map((k) => stripDiacritics(k).trim())
      .filter(Boolean);
    let score = 0;
    for (const kw of kws) if (hay.includes(" " + kw + " ")) score += kw.includes(" ") ? 2 : 1;
    if (score > 0 && (!best || score > best.score)) best = { id: c.id, score };
  }
  return best;
}
