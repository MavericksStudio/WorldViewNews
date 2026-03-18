export interface FeedEntry {
  url: string;
  name: string;
  category: 'breaking' | 'conflict' | 'politics' | 'economics' | 'tech' | 'environment' | 'regional';
  language: string;
  region?: string;
}

/**
 * Curated catalog of 60+ RSS/Atom feeds covering:
 *  - Major wire services (Reuters, AP, AFP)
 *  - Global broadcasters (BBC, Al Jazeera, CNN, NPR, France 24, DW, NHK)
 *  - State / regional media (TASS, Xinhua, CGTN, Anadolu, Prensa Latina)
 *  - Conflict / security (Janes, The War Zone, Bellingcat, ISW)
 *  - Financial (Bloomberg, FT, MarketWatch, CNBC, The Economist)
 *  - Technology / cyber (Ars Technica, The Register, Krebs on Security, Wired)
 *  - Environment / science (NOAA, NASA, Climate.gov, Reuters Environment, Guardian Env)
 */
export const feeds: FeedEntry[] = [
  // ─── Wire Services ────────────────────────────────────────────────────────
  {
    url: 'https://feeds.reuters.com/reuters/topNews',
    name: 'Reuters – Top News',
    category: 'breaking',
    language: 'en',
  },
  {
    url: 'https://feeds.reuters.com/Reuters/worldNews',
    name: 'Reuters – World',
    category: 'breaking',
    language: 'en',
  },
  {
    url: 'https://feeds.reuters.com/reuters/businessNews',
    name: 'Reuters – Business',
    category: 'economics',
    language: 'en',
  },
  {
    url: 'https://rsshub.app/ap/topics/apf-topnews',
    name: 'Associated Press – Top News',
    category: 'breaking',
    language: 'en',
  },
  {
    url: 'https://rsshub.app/ap/topics/apf-intlnews',
    name: 'Associated Press – International',
    category: 'breaking',
    language: 'en',
  },
  {
    url: 'https://www.afp.com/en/afpcom/rss',
    name: 'AFP – Global',
    category: 'breaking',
    language: 'en',
  },

  // ─── Major Broadcasters ────────────────────────────────────────────────────
  {
    url: 'https://feeds.bbci.co.uk/news/world/rss.xml',
    name: 'BBC – World',
    category: 'breaking',
    language: 'en',
    region: 'global',
  },
  {
    url: 'https://feeds.bbci.co.uk/news/politics/rss.xml',
    name: 'BBC – Politics',
    category: 'politics',
    language: 'en',
    region: 'europe',
  },
  {
    url: 'https://feeds.bbci.co.uk/news/technology/rss.xml',
    name: 'BBC – Technology',
    category: 'tech',
    language: 'en',
  },
  {
    url: 'https://feeds.bbci.co.uk/news/science_and_environment/rss.xml',
    name: 'BBC – Science & Environment',
    category: 'environment',
    language: 'en',
  },
  {
    url: 'https://www.aljazeera.com/xml/rss/all.xml',
    name: 'Al Jazeera – All',
    category: 'breaking',
    language: 'en',
    region: 'middle-east',
  },
  {
    url: 'https://rss.cnn.com/rss/edition.rss',
    name: 'CNN – World',
    category: 'breaking',
    language: 'en',
    region: 'global',
  },
  {
    url: 'https://rss.cnn.com/rss/edition_world.rss',
    name: 'CNN – International',
    category: 'breaking',
    language: 'en',
    region: 'global',
  },
  {
    url: 'https://feeds.npr.org/1001/rss.xml',
    name: 'NPR – News',
    category: 'breaking',
    language: 'en',
    region: 'americas',
  },
  {
    url: 'https://feeds.npr.org/1004/rss.xml',
    name: 'NPR – World',
    category: 'breaking',
    language: 'en',
    region: 'global',
  },
  {
    url: 'https://www.france24.com/en/rss',
    name: 'France 24 – English',
    category: 'breaking',
    language: 'en',
    region: 'global',
  },
  {
    url: 'https://www.france24.com/fr/rss',
    name: 'France 24 – Français',
    category: 'breaking',
    language: 'fr',
    region: 'global',
  },
  {
    url: 'https://rss.dw.com/rdf/rss-en-all',
    name: 'Deutsche Welle – English',
    category: 'breaking',
    language: 'en',
    region: 'europe',
  },
  {
    url: 'https://www3.nhk.or.jp/rss/news/cat0.xml',
    name: 'NHK World – Top',
    category: 'breaking',
    language: 'en',
    region: 'asia-pacific',
  },
  {
    url: 'https://feeds.foxnews.com/foxnews/world',
    name: 'Fox News – World',
    category: 'breaking',
    language: 'en',
    region: 'global',
  },
  {
    url: 'https://feeds.nbcnews.com/nbcnews/public/world',
    name: 'NBC News – World',
    category: 'breaking',
    language: 'en',
    region: 'global',
  },

  // ─── State / Regional Media ────────────────────────────────────────────────
  {
    url: 'https://tass.com/rss/v2.xml',
    name: 'TASS – Russia',
    category: 'regional',
    language: 'en',
    region: 'eurasia',
  },
  {
    url: 'https://www.rt.com/rss/',
    name: 'RT – Russia Today',
    category: 'regional',
    language: 'en',
    region: 'eurasia',
  },
  {
    url: 'https://www.xinhuanet.com/english/rss/worldrss.xml',
    name: 'Xinhua – World',
    category: 'regional',
    language: 'en',
    region: 'asia-pacific',
  },
  {
    url: 'https://www.cgtn.com/subscribe/rss/section/world.do',
    name: 'CGTN – World',
    category: 'regional',
    language: 'en',
    region: 'asia-pacific',
  },
  {
    url: 'https://www.haaretz.com/cmlink/1.628764',
    name: 'Haaretz – Israel',
    category: 'regional',
    language: 'en',
    region: 'middle-east',
  },
  {
    url: 'https://www.timesofisrael.com/feed/',
    name: 'Times of Israel',
    category: 'regional',
    language: 'en',
    region: 'middle-east',
  },
  {
    url: 'https://english.aawsat.com/rss.xml',
    name: 'Asharq Al-Awsat',
    category: 'regional',
    language: 'en',
    region: 'middle-east',
  },
  {
    url: 'https://feeds.feedburner.com/ndtvnews-world-news',
    name: 'NDTV – World',
    category: 'regional',
    language: 'en',
    region: 'south-asia',
  },
  {
    url: 'https://timesofindia.indiatimes.com/rssfeeds/-2128936835.cms',
    name: 'Times of India – World',
    category: 'regional',
    language: 'en',
    region: 'south-asia',
  },
  {
    url: 'https://www.dawn.com/feed',
    name: 'Dawn – Pakistan',
    category: 'regional',
    language: 'en',
    region: 'south-asia',
  },
  {
    url: 'https://en.yonhapnews.co.kr/RSS/contents.xml',
    name: 'Yonhap – South Korea',
    category: 'regional',
    language: 'en',
    region: 'asia-pacific',
  },
  {
    url: 'https://www.kyodonews.net/news/world/rss',
    name: 'Kyodo News – Japan',
    category: 'regional',
    language: 'en',
    region: 'asia-pacific',
  },
  {
    url: 'https://www.aa.com.tr/en/rss/default?cat=world',
    name: 'Anadolu Agency – World',
    category: 'regional',
    language: 'en',
    region: 'middle-east',
  },
  {
    url: 'https://www.prensalatina.com.mx/rss/en/',
    name: 'Prensa Latina – Americas',
    category: 'regional',
    language: 'en',
    region: 'americas',
  },

  // ─── Conflict / Security ──────────────────────────────────────────────────
  {
    url: 'https://www.janes.com/feeds/news',
    name: "Janes – Defence & Security",
    category: 'conflict',
    language: 'en',
  },
  {
    url: 'https://www.thedrive.com/the-war-zone/rss',
    name: 'The War Zone – Defence',
    category: 'conflict',
    language: 'en',
  },
  {
    url: 'https://www.bellingcat.com/feed/',
    name: 'Bellingcat – OSINT',
    category: 'conflict',
    language: 'en',
  },
  {
    url: 'https://www.understandingwar.org/rss.xml',
    name: 'ISW – Institute for the Study of War',
    category: 'conflict',
    language: 'en',
  },
  {
    url: 'https://acleddata.com/feed/',
    name: 'ACLED – Armed Conflict',
    category: 'conflict',
    language: 'en',
  },
  {
    url: 'https://www.defenseone.com/rss/all/',
    name: 'Defense One',
    category: 'conflict',
    language: 'en',
  },
  {
    url: 'https://breakingdefense.com/feed/',
    name: 'Breaking Defense',
    category: 'conflict',
    language: 'en',
  },
  {
    url: 'https://theintercept.com/feed/?rss',
    name: 'The Intercept – National Security',
    category: 'conflict',
    language: 'en',
  },
  {
    url: 'https://foreignpolicy.com/feed/',
    name: 'Foreign Policy',
    category: 'conflict',
    language: 'en',
  },
  {
    url: 'https://www.crisisgroup.org/rss',
    name: 'ICG – International Crisis Group',
    category: 'conflict',
    language: 'en',
  },

  // ─── Financial / Economics ────────────────────────────────────────────────
  {
    url: 'https://feeds.bloomberg.com/markets/news.rss',
    name: 'Bloomberg – Markets',
    category: 'economics',
    language: 'en',
  },
  {
    url: 'https://www.ft.com/rss/home',
    name: 'Financial Times – Home',
    category: 'economics',
    language: 'en',
  },
  {
    url: 'https://feeds.marketwatch.com/marketwatch/topstories/',
    name: 'MarketWatch – Top Stories',
    category: 'economics',
    language: 'en',
  },
  {
    url: 'https://www.cnbc.com/id/100003114/device/rss/rss.html',
    name: 'CNBC – World Economy',
    category: 'economics',
    language: 'en',
  },
  {
    url: 'https://www.economist.com/finance-and-economics/rss.xml',
    name: 'The Economist – Finance',
    category: 'economics',
    language: 'en',
  },
  {
    url: 'https://www.wsj.com/xml/rss/3_7085.xml',
    name: 'Wall Street Journal – Markets',
    category: 'economics',
    language: 'en',
  },
  {
    url: 'https://www.imf.org/en/News/rss',
    name: 'IMF – News',
    category: 'economics',
    language: 'en',
  },
  {
    url: 'https://www.worldbank.org/en/news/rss.xml',
    name: 'World Bank – News',
    category: 'economics',
    language: 'en',
  },

  // ─── Technology / Cyber ───────────────────────────────────────────────────
  {
    url: 'https://feeds.arstechnica.com/arstechnica/index',
    name: 'Ars Technica – All',
    category: 'tech',
    language: 'en',
  },
  {
    url: 'https://feeds.arstechnica.com/arstechnica/security',
    name: 'Ars Technica – Security',
    category: 'tech',
    language: 'en',
  },
  {
    url: 'https://www.theregister.com/headlines.atom',
    name: 'The Register',
    category: 'tech',
    language: 'en',
  },
  {
    url: 'https://krebsonsecurity.com/feed/',
    name: 'Krebs on Security',
    category: 'tech',
    language: 'en',
  },
  {
    url: 'https://www.wired.com/feed/rss',
    name: 'Wired',
    category: 'tech',
    language: 'en',
  },
  {
    url: 'https://www.schneier.com/blog/atom.xml',
    name: 'Schneier on Security',
    category: 'tech',
    language: 'en',
  },
  {
    url: 'https://feeds.feedburner.com/TheHackersNews',
    name: 'The Hacker News',
    category: 'tech',
    language: 'en',
  },
  {
    url: 'https://www.darkreading.com/rss.xml',
    name: 'Dark Reading – Cyber',
    category: 'tech',
    language: 'en',
  },
  {
    url: 'https://techcrunch.com/feed/',
    name: 'TechCrunch',
    category: 'tech',
    language: 'en',
  },

  // ─── Environment / Science ────────────────────────────────────────────────
  {
    url: 'https://www.climate.gov/feeds/news-features/stories.rss',
    name: 'NOAA Climate.gov',
    category: 'environment',
    language: 'en',
  },
  {
    url: 'https://science.nasa.gov/feeds/earth/',
    name: 'NASA Earth Science',
    category: 'environment',
    language: 'en',
  },
  {
    url: 'https://www.theguardian.com/environment/rss',
    name: 'The Guardian – Environment',
    category: 'environment',
    language: 'en',
  },
  {
    url: 'https://feeds.reuters.com/reuters/environment',
    name: 'Reuters – Environment',
    category: 'environment',
    language: 'en',
  },
  {
    url: 'https://e360.yale.edu/feed',
    name: 'Yale Environment 360',
    category: 'environment',
    language: 'en',
  },
  {
    url: 'https://www.carbonbrief.org/feed',
    name: 'Carbon Brief – Climate',
    category: 'environment',
    language: 'en',
  },
  {
    url: 'https://www.sciencedaily.com/rss/earth_climate/climate.xml',
    name: 'Science Daily – Climate',
    category: 'environment',
    language: 'en',
  },
  {
    url: 'https://www.preventionweb.net/news/rss',
    name: 'UNDRR – Disaster Risk',
    category: 'environment',
    language: 'en',
  },
  {
    url: 'https://reliefweb.int/rss/disasters',
    name: 'ReliefWeb – Disasters',
    category: 'environment',
    language: 'en',
  },
];
