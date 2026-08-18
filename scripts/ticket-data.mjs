const officialEvents = [
  {
    id: "bigbang-goyang-2026",
    artist: "BIGBANG",
    title: "2026 WORLD TOUR IN GOYANG",
    dateLabel: "AUG 21—23",
    dateDetail: "08.21 FRI 19:30 · 08.22 SAT 19:30 · 08.23 SUN 19:00",
    city: "GOYANG",
    venue: "고양종합운동장",
    ticketStatus: "GENERAL SALE",
    ticketing: "쿠팡플레이 · NOL WORLD",
    source: "YG ENTERTAINMENT",
    sourceUrl: "https://www.ygfamily.com/ko/news/notice/5876",
    startAt: "2026-08-21T19:30:00+09:00",
    endAt: "2026-08-23T22:00:00+09:00",
  },
  {
    id: "stayc-seoul-2026",
    artist: "STAYC",
    title: "FAN CONCERT TOUR [STAY CLOSER]",
    dateLabel: "AUG 22—23",
    dateDetail: "08.22 SAT 18:00 · 08.23 SUN 17:00",
    city: "SEOUL",
    venue: "블루스퀘어 우리WON뱅킹홀",
    ticketStatus: "OFFICIAL NOTICE",
    ticketing: "공식 공지에서 예매 정보 확인",
    source: "WEVERSE",
    sourceUrl: "https://weverse.io/stayc/notice/37102",
    startAt: "2026-08-22T18:00:00+09:00",
    endAt: "2026-08-23T20:00:00+09:00",
  },
  {
    id: "bts-toronto-2026",
    artist: "BTS",
    title: "WORLD TOUR ‘ARIRANG’",
    dateLabel: "AUG 22—23",
    dateDetail: "08.22 SAT · 08.23 SUN",
    city: "TORONTO",
    venue: "ROGERS STADIUM",
    ticketStatus: "COMING SOON",
    ticketing: "Weverse Spot 공연 상세",
    source: "WEVERSE SPOT",
    sourceUrl: "https://spot.weverse.io/bts-arirang-tour?language=en",
    startAt: "2026-08-22T19:00:00-04:00",
    endAt: "2026-08-23T23:00:00-04:00",
  },
  {
    id: "tws-fukuoka-2026",
    artist: "TWS",
    title: "TOUR ‘24/7:FOR:YOU’",
    dateLabel: "AUG 28—30",
    dateDetail: "08.28 FRI — 08.30 SUN",
    city: "FUKUOKA",
    venue: "FUKUOKA KOKUSAI CENTER",
    ticketStatus: "TOUR DATE",
    ticketing: "공식 공지에서 상세 일정 확인",
    source: "WEVERSE",
    sourceUrl: "https://weverse.io/tws/notice/35444",
    startAt: "2026-08-28T18:00:00+09:00",
    endAt: "2026-08-30T21:00:00+09:00",
  },
  {
    id: "uknow-bangkok-2026",
    artist: "U-KNOW",
    title: "PROJECT 26 : SCENE#1",
    dateLabel: "AUG 29",
    dateDetail: "08.29 SAT",
    city: "BANGKOK",
    venue: "THUNDER DOME",
    ticketStatus: "TOUR DATE",
    ticketing: "현지 프로모터 예매 공지 예정",
    source: "WEVERSE",
    sourceUrl: "https://weverse.io/tvxq/notice/36779",
    startAt: "2026-08-29T19:00:00+07:00",
    endAt: "2026-08-29T23:00:00+07:00",
  },
  {
    id: "aespa-sao-paulo-2026",
    artist: "aespa",
    title: "2026-27 LIVE TOUR",
    dateLabel: "SEP 04",
    dateDetail: "09.04 FRI",
    city: "SÃO PAULO",
    venue: "공연 상세 추후 공지",
    ticketStatus: "ANNOUNCED",
    ticketing: "티켓 일정 추후 공지",
    source: "WEVERSE",
    sourceUrl: "https://weverse.io/aespa/notice/35057",
    startAt: "2026-09-04T19:00:00-03:00",
    endAt: "2026-09-04T23:00:00-03:00",
  },
  {
    id: "plave-incheon-2026",
    artist: "PLAVE",
    title: "WORLD TOUR [KEEP IT MANIC]",
    dateLabel: "SEP 12—13",
    dateDetail: "09.12 SAT 19:00 · 09.13 SUN 19:00",
    city: "INCHEON",
    venue: "인천문학경기장 주경기장",
    ticketStatus: "GENERAL SALE",
    ticketing: "NOL",
    source: "WEVERSE",
    sourceUrl: "https://weverse.io/plave/notice/37847",
    startAt: "2026-09-12T19:00:00+09:00",
    endAt: "2026-09-13T22:00:00+09:00",
  },
];

export function createTicketPayload(now = new Date()) {
  const currentTime = now.getTime();
  const upcoming = officialEvents
    .filter((event) => new Date(event.endAt).getTime() >= currentTime)
    .sort((left, right) => new Date(left.startAt).getTime() - new Date(right.startAt).getTime())
    .slice(0, 4)
    .map(toPublicEvent);

  const entries = upcoming.length >= 4
    ? upcoming
    : officialEvents.slice(-4).map(toPublicEvent);

  return {
    updatedLabel: "SOURCE VERIFIED · 2026.08.18",
    headline: "NEXT STAGE,\nRIGHT ON TIME.",
    intro: "공식 공지를 기준으로 지금 가장 가까운 K-pop 공연과 투어 일정을 모았습니다. 예매 전에는 반드시 원문에서 잔여석과 변경 사항을 확인해 주세요.",
    entries,
  };
}

function toPublicEvent(event) {
  const publicEvent = { ...event };
  delete publicEvent.startAt;
  delete publicEvent.endAt;
  return publicEvent;
}
