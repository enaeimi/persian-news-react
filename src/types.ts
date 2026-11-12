export interface NewsItem {
  title: string;
  link: string;
  summary: string;
  published: string | null;
  image: string | null;
}

export interface NewsFeed {
  source: { id: string; name: string; homepage: string };
  fetchedAt: string;
  method: string;
  items: NewsItem[];
}
