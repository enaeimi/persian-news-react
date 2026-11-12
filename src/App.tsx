import { useMemo, useState } from 'react';
import { formatDate, timeAgo } from './format';
import { Pager } from './Pager';
import { pageCount, type PagerLabels } from './paging';
import { useNews } from './useNews';

const PAGE_SIZE = 15;
const LABELS: PagerLabels = { prev: 'قبلی', next: 'بعدی', nav: 'صفحه‌بندی', num: (n: number) => n.toLocaleString('fa-IR') };

export default function App() {
  const { feed, error, loading, reload } = useNews();
  const [query, setQuery] = useState('');

  const items = useMemo(() => {
    const q = query.trim();
    if (!feed) return [];
    if (!q) return feed.items;
    return feed.items.filter((i) => i.title.includes(q) || i.summary.includes(q));
  }, [feed, query]);

  // Paging: back to page 1 when the search changes (but not on auto-refresh).
  const [paging, setPaging] = useState({ key: query, page: 1 });
  const pages = pageCount(items.length, PAGE_SIZE);
  const page = Math.min(paging.key === query ? paging.page : 1, pages);
  const pageItems = items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const goTo = (p: number) => {
    setPaging({ key: query, page: p });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="page">
      <header className="header">
        <div>
          <h1>آخرین اخبار {feed?.source.name ?? 'بی‌بی‌سی فارسی'}</h1>
          {feed && (
            <p className="meta">
              به‌روزرسانی: {formatDate(feed.fetchedAt)} ({timeAgo(feed.fetchedAt)})
            </p>
          )}
        </div>
        <button onClick={reload} disabled={loading}>
          {loading ? 'در حال بارگذاری…' : 'بارگذاری دوباره'}
        </button>
      </header>

      <input
        className="search"
        type="search"
        placeholder="جستجو در عنوان‌ها…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      {error && !feed && (
        <p className="error">
          دریافت اخبار ناموفق بود ({error}). در حالت توسعه ابتدا <code>npm run fetch-news</code> را اجرا کنید.
        </p>
      )}

      <ul className="list">
        {pageItems.map((item) => (
          <li key={item.link} className="card">
            {item.image && <img src={item.image} alt="" loading="lazy" />}
            <div>
              <a href={item.link} target="_blank" rel="noopener noreferrer">
                <h2>{item.title}</h2>
              </a>
              {item.summary && <p>{item.summary}</p>}
              {item.published && (
                <time dateTime={item.published} title={formatDate(item.published)}>
                  {timeAgo(item.published)}
                </time>
              )}
            </div>
          </li>
        ))}
      </ul>

      <Pager page={page} total={pages} labels={LABELS} onChange={goTo} />
      {pages > 1 && <p className="pager-info">{`صفحهٔ ${LABELS.num(page)} از ${LABELS.num(pages)}`}</p>}

      {feed && items.length === 0 && <p className="meta">خبری یافت نشد.</p>}

      <footer className="meta">
        منبع: <a href={feed?.source.homepage ?? 'https://www.bbc.com/persian'}>{feed?.source.name ?? 'BBC Persian'}</a>
        {' · '}تمام حقوق محتوا متعلق به منبع است.
      </footer>
    </div>
  );
}
