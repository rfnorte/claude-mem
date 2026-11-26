/**
 * Dados de DEMONSTRAÇÃO — inteiramente fictícios e gerados localmente.
 * Não correspondem a canais, filmes ou séries reais e não contêm URLs de
 * reprodução. Servem para avaliar a interface antes de existir uma lista real.
 *
 * Geração determinística (mesma semente → mesmos dados) para testes estáveis.
 */

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = (r, list) => list[Math.floor(r() * list.length)];

const PLACES = ['Atlântico', 'Horizonte', 'Estrela', 'Ribeira', 'Planalto', 'Litoral', 'Aurora', 'Meridiano', 'Farol', 'Serra', 'Vale', 'Brisa', 'Nascente', 'Cais', 'Ponte', 'Arco', 'Lume', 'Bússola', 'Maré', 'Quinta'];

const CATEGORIES = [
  { id: 'gen', name: 'Generalistas', suffixes: ['TV', 'Um', 'Canal', 'Mais'], shows: ['Jornal da Tarde', 'Manhã em Casa', 'Grande Concurso', 'Novela: Rio Fundo', 'Telejornal', 'Talk Show da Noite'] },
  { id: 'news', name: 'Notícias', suffixes: ['Notícias', '24', 'Informação', 'Atualidade'], shows: ['Edição da Manhã', 'Mercados em Direto', 'Grande Entrevista', 'Última Hora', 'Debate da Semana'] },
  { id: 'sport', name: 'Desporto', suffixes: ['Desporto', 'Sport', 'Arena', 'Golo'], shows: ['Liga em Direto', 'Resumo da Jornada', 'Ténis: Final', 'Ciclismo: Etapa 12', 'Magazine Motores'] },
  { id: 'movies', name: 'Cinema', suffixes: ['Cinema', 'Filmes', 'Película', 'Ecrã'], shows: ['O Último Farol', 'Cidade de Vidro', 'Noite em Lisboa', 'A Travessia', 'Sombras do Norte'] },
  { id: 'kids', name: 'Infantil', suffixes: ['Kids', 'Júnior', 'Mini', 'Brinca'], shows: ['Aventuras no Bosque', 'Robôs Amigos', 'A Pequena Exploradora', 'Desenhos da Manhã'] },
  { id: 'music', name: 'Música', suffixes: ['Música', 'Hits', 'Sons', 'Rádio Visual'], shows: ['Top 40', 'Concerto ao Vivo', 'Clássicos dos 90', 'Sessão Acústica'] },
  { id: 'docs', name: 'Documentários', suffixes: ['Docs', 'Descobrir', 'Natureza', 'História'], shows: ['Oceanos Profundos', 'Grandes Civilizações', 'Vida Selvagem', 'Engenharia Extrema'] },
  { id: 'intl', name: 'Internacional', suffixes: ['World', 'Global', 'Europa', 'Internacional'], shows: ['World Report', 'Travel Diaries', 'Cooking Abroad', 'Global Business'] },
];

const QUALITIES = ['', '', '', ' HD', ' HD', ' FHD', ' 4K'];

const GENRES = ['Drama', 'Comédia', 'Ação', 'Thriller', 'Ficção científica', 'Romance', 'Animação', 'Documentário', 'Aventura', 'Mistério'];
const TITLE_A = ['O Último', 'A Cidade', 'Noite', 'O Segredo', 'A Travessia', 'Sombras', 'O Jardim', 'Linha', 'A Casa', 'O Mapa', 'Ecos', 'Depois', 'A Ilha', 'O Silêncio', 'Faróis'];
const TITLE_B = ['de Vidro', 'do Norte', 'em Lisboa', 'Perdido', 'do Sul', 'Azul', 'de Inverno', 'Invisível', 'das Marés', 'sem Nome', 'de Papel', 'do Tempo', 'Distante', 'Esquecido', 'de Prata'];
const SERIES_A = ['Crónicas', 'Distrito', 'Herdeiros', 'Fronteira', 'Turno', 'Família', 'Código', 'Expedição', 'Hotel', 'Laboratório', 'Esquadra', 'Arquivo'];
const SERIES_B = ['do Porto', 'Zero', 'da Serra', 'Norte', 'da Noite', 'Atlântica', 'Vermelho', 'Polar', 'Central', 'Secreto', '7', 'Final'];
const EP_TITLES = ['Piloto', 'O Regresso', 'Sinais', 'Ponto de Rutura', 'Aliados', 'A Escolha', 'Fogo Cruzado', 'Revelações', 'Sem Saída', 'Recomeço', 'Herança', 'O Plano'];

const DESCRIPTION = (genre, title) =>
  `Conteúdo fictício de demonstração (${genre.toLowerCase()}). "${title}" serve apenas para pré-visualizar a interface: capa, metadados, favoritos e progresso.`;

export function createDemoCatalog(seed = 2026) {
  const r = rng(seed);
  const now = Date.now();
  const DAY = 86_400_000;

  const categories = CATEGORIES.map(({ id, name }) => ({ id, name, kind: 'live' }));
  const channels = [];
  let n = 1;
  for (const cat of CATEGORIES) {
    const count = 18 + Math.floor(r() * 18);
    const used = new Set();
    for (let i = 0; i < count; i++) {
      let name;
      do { name = `${pick(r, PLACES)} ${pick(r, cat.suffixes)}${pick(r, QUALITIES)}`; } while (used.has(name));
      used.add(name);
      channels.push({
        id: `demo-ch-${n}`,
        kind: 'live',
        number: n++,
        name,
        logo: null,
        categoryId: cat.id,
        categoryName: cat.name,
        demoShows: cat.shows,
        slot: pick(r, [30, 45, 60, 90]),
        offset: Math.floor(r() * 90),
      });
    }
  }

  const movies = [];
  const usedTitles = new Set();
  for (let i = 0; i < 72; i++) {
    let name;
    do { name = `${pick(r, TITLE_A)} ${pick(r, TITLE_B)}`; } while (usedTitles.has(name));
    usedTitles.add(name);
    const g1 = pick(r, GENRES);
    const genres = r() > 0.5 ? [g1, pick(r, GENRES.filter((g) => g !== g1))] : [g1];
    const durationMin = 82 + Math.floor(r() * 70);
    movies.push({
      id: `demo-mv-${i + 1}`,
      kind: 'movie',
      name,
      poster: null,
      year: 1994 + Math.floor(r() * 33),
      genres,
      durationMin,
      rating: Math.round((5.5 + r() * 4) * 10) / 10,
      description: DESCRIPTION(g1, name),
      addedAt: now - Math.floor(r() * 60) * DAY,
      categoryId: g1,
    });
  }

  const series = [];
  const usedSeries = new Set();
  for (let i = 0; i < 28; i++) {
    let name;
    do { name = `${pick(r, SERIES_A)} ${pick(r, SERIES_B)}`; } while (usedSeries.has(name));
    usedSeries.add(name);
    const g1 = pick(r, GENRES);
    const seasonCount = 1 + Math.floor(r() * 5);
    const seasons = [];
    for (let s = 1; s <= seasonCount; s++) {
      const epCount = 6 + Math.floor(r() * 6);
      seasons.push({
        number: s,
        episodes: Array.from({ length: epCount }, (_, e) => ({
          id: `demo-ep-${i + 1}-${s}-${e + 1}`,
          season: s,
          episode: e + 1,
          name: e === 0 && s === 1 ? 'Piloto' : pick(r, EP_TITLES),
          durationMin: 38 + Math.floor(r() * 22),
        })),
      });
    }
    series.push({
      id: `demo-sr-${i + 1}`,
      kind: 'series',
      name,
      poster: null,
      year: 2008 + Math.floor(r() * 19),
      genres: [g1],
      rating: Math.round((6 + r() * 3.5) * 10) / 10,
      description: DESCRIPTION(g1, name),
      addedAt: now - Math.floor(r() * 90) * DAY,
      seasons,
      categoryId: g1,
    });
  }

  // Histórico fictício (o leitor real só existe na Fase 4)
  const history = [
    { kind: 'movie', id: movies[3].id, percent: 42, updatedAt: now - 2 * 3_600_000 },
    { kind: 'episode', seriesId: series[1].id, season: 1, episode: 3, percent: 68, updatedAt: now - 5 * 3_600_000 },
    { kind: 'movie', id: movies[10].id, percent: 15, updatedAt: now - DAY },
    { kind: 'episode', seriesId: series[4].id, season: 2, episode: 1, percent: 30, updatedAt: now - 2 * DAY },
    { kind: 'live', id: channels[0].id, updatedAt: now - 30 * 60_000 },
    { kind: 'live', id: channels[40].id, updatedAt: now - 3 * 3_600_000 },
    { kind: 'live', id: channels[75].id, updatedAt: now - DAY },
  ];

  return { categories, channels, movies, series, history, popular: [0, 40, 1, 75, 41, 2, 110, 76, 3, 42].map((i) => channels[i]).filter(Boolean) };
}

/** EPG fictício calculado no momento (agora / a seguir) para um canal de demonstração. */
export function demoEpg(channel, now = Date.now()) {
  const slotMs = channel.slot * 60_000;
  const base = Math.floor((now + channel.offset * 60_000) / slotMs) * slotMs - channel.offset * 60_000;
  const idx = Math.floor(base / slotMs) + channel.number;
  const shows = channel.demoShows;
  return {
    now: { title: shows[idx % shows.length], start: base, stop: base + slotMs },
    next: { title: shows[(idx + 1) % shows.length], start: base + slotMs, stop: base + 2 * slotMs },
  };
}
