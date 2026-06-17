// Build step: convert content/news/*.md into news.html cards + individual article pages.
// Runs on Cloudflare Pages on every deploy.

const fs = require("fs");
const path = require("path");
const matter = require("gray-matter");
const { marked } = require("marked");

const ROOT = __dirname;
const NEWS_DIR = path.join(ROOT, "content", "news");
const NEWS_OUT_DIR = path.join(ROOT, "news");
const NEWS_INDEX = path.join(ROOT, "news.html");

function readArticles() {
  if (!fs.existsSync(NEWS_DIR)) return [];
  return fs
    .readdirSync(NEWS_DIR)
    .filter((f) => f.endsWith(".md"))
    .map((f) => {
      const raw = fs.readFileSync(path.join(NEWS_DIR, f), "utf8");
      const { data, content } = matter(raw);
      const slug = f.replace(/\.md$/, "");
      return {
        slug,
        title: data.title || "Untitled",
        date: data.date ? new Date(data.date) : new Date(),
        category: data.category || "News",
        thumbnail: data.thumbnail || "",
        excerpt: data.excerpt || "",
        body: marked.parse(content || ""),
        published: data.published !== false,
      };
    })
    .filter((a) => a.published)
    .sort((a, b) => b.date - a.date);
}

function fmtDate(d) {
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function thumbMarkup(a) {
  if (a.thumbnail) {
    return `<div class="news-thumb"><img src="${escapeHtml(a.thumbnail)}" alt="${escapeHtml(a.title)}" /></div>`;
  }
  const variants = ["var-1", "var-2", "var-3", "var-4"];
  const v = variants[Math.abs(hash(a.slug)) % variants.length];
  return `<div class="news-thumb ${v}"><span>📰</span></div>`;
}

function hash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}

function cardMarkup(a) {
  const url = `news/${a.slug}.html`;
  return `      <article class="news-card">
        ${thumbMarkup(a)}
        <div class="news-body">
          <div class="news-meta">${fmtDate(a.date)} · ${escapeHtml(a.category)}</div>
          <h3><a href="${url}">${escapeHtml(a.title)}</a></h3>
          <p>${escapeHtml(a.excerpt)}</p>
          <a class="news-link" href="${url}">Read more</a>
        </div>
      </article>`;
}

function buildNewsIndex(articles) {
  const tpl = fs.readFileSync(NEWS_INDEX, "utf8");
  const cards = articles.map(cardMarkup).join("\n");
  const replaced = tpl.replace(
    /<div class="news-grid">[\s\S]*?<\/div>\s*<\/div>\s*<\/section>/m,
    `<div class="news-grid">\n${cards}\n    </div>\n  </div>\n</section>`
  );
  fs.writeFileSync(NEWS_INDEX, replaced);
}

function articlePage(a) {
  const tpl = fs.readFileSync(NEWS_INDEX, "utf8");
  const head = tpl.split("<section class=\"page-header\">")[0];
  const footer = tpl.split("<footer class=\"site-footer\">")[1];
  const fixedHead = head
    .replace(/href="assets\//g, 'href="../assets/')
    .replace(/src="assets\//g, 'src="../assets/')
    .replace(/href="index\.html"/g, 'href="../index.html"')
    .replace(/href="about\.html"/g, 'href="../about.html"')
    .replace(/href="academics\.html"/g, 'href="../academics.html"')
    .replace(/href="student-life\.html"/g, 'href="../student-life.html"')
    .replace(/href="news\.html"/g, 'href="../news.html"')
    .replace(/href="contact\.html"/g, 'href="../contact.html"')
    .replace(/href="admissions\.html"/g, 'href="../admissions.html"')
    .replace(/href="tc\/index\.html"/g, 'href="../tc/index.html"')
    .replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(a.title)} · Cognitio Lutheran Secondary School</title>`);

  const fixedFooter = ("<footer class=\"site-footer\">" + footer)
    .replace(/href="assets\//g, 'href="../assets/')
    .replace(/src="assets\//g, 'src="../assets/')
    .replace(/href="index\.html"/g, 'href="../index.html"')
    .replace(/href="about\.html"/g, 'href="../about.html"')
    .replace(/href="academics\.html"/g, 'href="../academics.html"')
    .replace(/href="student-life\.html"/g, 'href="../student-life.html"')
    .replace(/href="news\.html"/g, 'href="../news.html"')
    .replace(/href="contact\.html"/g, 'href="../contact.html"')
    .replace(/href="admissions\.html"/g, 'href="../admissions.html"')
    .replace(/href="tc\/index\.html"/g, 'href="../tc/index.html"')
    .replace(/src="assets\/js\/main\.js"/g, 'src="../assets/js/main.js"');

  const heroImg = a.thumbnail
    ? `<div class="article-hero" style="background-image:url('../${escapeHtml(a.thumbnail)}')"></div>`
    : "";

  return `${fixedHead}
<section class="page-header">
  <div class="container">
    <div class="crumbs"><a href="../news.html">News</a> · ${escapeHtml(a.category)}</div>
    <h1>${escapeHtml(a.title)}</h1>
    <p>${fmtDate(a.date)}</p>
  </div>
</section>

<section class="section">
  <div class="container article-container">
    ${heroImg}
    <article class="article-prose">
      ${a.body}
    </article>
    <p style="margin-top:40px"><a class="btn btn-dark" href="../news.html">← Back to News</a></p>
  </div>
</section>

${fixedFooter}`;
}

function buildArticles(articles) {
  if (!fs.existsSync(NEWS_OUT_DIR)) fs.mkdirSync(NEWS_OUT_DIR, { recursive: true });
  // Clean previous generated files
  for (const f of fs.readdirSync(NEWS_OUT_DIR)) {
    if (f.endsWith(".html")) fs.unlinkSync(path.join(NEWS_OUT_DIR, f));
  }
  for (const a of articles) {
    fs.writeFileSync(path.join(NEWS_OUT_DIR, `${a.slug}.html`), articlePage(a));
  }
}

const articles = readArticles();
console.log(`Found ${articles.length} published article(s).`);
if (articles.length > 0) {
  buildNewsIndex(articles);
  buildArticles(articles);
  console.log("News pages rebuilt.");
} else {
  console.log("No articles yet — leaving news.html as-is.");
}
