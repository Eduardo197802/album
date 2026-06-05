import { StatusBar } from 'expo-status-bar';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Clipboard from 'expo-clipboard';
import QRCode from 'react-native-qrcode-svg';
import { useEffect, useMemo, useState } from 'react';
import { createClient, type Session } from '@supabase/supabase-js';
import {
  FlatList,
  Image,
  Linking,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';

type AlbumRow = {
  id: string;
  group: string;
  country: string;
  prefix: string;
  total: number;
  firstCodeZero?: boolean;
  startAt?: number;
};

type GroupFilter = 'Todos' | 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I' | 'J' | 'K' | 'L' | 'Extras';
type ShareScope = 'repetidas' | 'faltantes' | 'ambas';
type ShareTarget = 'share' | 'whatsapp' | 'mail';

type ParsedQrData = {
  scope: 'R' | 'F' | 'A';
  repeated: Record<string, number>;
  missing: Set<string>;
};

type PersistedAppState = {
  codeCounts: Record<string, number>;
  activeTab: 'controle' | 'estatistica' | 'repetidas' | 'faltantes' | 'troca';
  search: string;
  groupFilter: GroupFilter;
  shareScope: ShareScope;
  showQrCode: boolean;
  expandedRowMap: Record<string, boolean>;
};

type CloudAlbumStateRow = {
  code_counts: Record<string, number>;
  active_tab: PersistedAppState['activeTab'];
  search: string;
  group_filter: GroupFilter;
  share_scope: ShareScope;
  show_qr_code: boolean;
  expanded_row_map: Record<string, boolean>;
};

type AuthErrorLike = {
  status?: number;
  code?: string;
  message?: string;
};

const supabaseUrl = 'https://kkygflqiuguflvnjsjpw.supabase.co';
const supabasePublishableKey = 'sb_publishable_2qGwkTObYMwUuvTh7-3WVQ_lpQ85SND';
const supabase = createClient(supabaseUrl, supabasePublishableKey);

const seededMissingByRowId: Partial<Record<AlbumRow['id'], number[]>> = {
  PGI: [3, 5, 6, 7],
  FWC: [13],
  MEX: [5, 6, 11, 12, 15, 17, 18],
  RSA: [1, 18],
  KOR: [1, 8, 16, 19, 20],
  CZE: [3, 8, 10, 11, 13, 17, 18, 19, 20],
  CAN: [2, 6, 10, 12, 13, 14, 17, 18],
  BIH: [6, 14, 15, 17, 18, 19],
  QAT: [5, 7, 17],
  BRA: [2, 4, 11, 13, 14],
  MAR: [11],
  HAI: [2, 6, 10, 13, 15, 19],
  SCO: [7, 12, 18, 20],
  USA: [1, 3, 4, 6, 8, 9, 14, 17, 18],
  PAR: [1, 9, 12, 13],
  AUS: [3, 6, 15, 16, 20],
  TUR: [1, 2, 5, 6, 8, 9, 11, 13, 14],
  GER: [7, 13, 18, 20],
  CUW: [8, 12, 13, 17, 20],
  CIV: [2, 6, 7, 11, 16, 17, 20],
  ECU: [5, 13, 18],
  NED: [1, 3, 7, 13, 16, 20],
  JPN: [1, 5, 6, 10],
  SWE: [2, 3, 6, 8, 10, 11, 12, 15, 16, 20],
  TUN: [2, 5, 6, 10, 17, 19],
  BEL: [2, 6, 7, 17, 19],
  EGY: [3, 4, 7, 13, 14, 15, 18, 19, 20],
  IRN: [2, 5, 6, 9, 13, 14, 18],
  NZL: [3, 13, 16],
  ESP: [1, 4, 13, 20],
  CPV: [4, 5, 6, 8, 9, 18],
  KSA: [1, 5, 6],
  URU: [2, 8, 9, 12, 15, 19],
  FRA: [2, 5, 10, 13, 15, 19],
  SEN: [1],
  IRQ: [1, 3, 4, 9, 10, 16],
  NOR: [1, 5, 6, 11, 16, 17, 18],
  ARG: [2, 3, 7, 10, 11, 17, 18, 20],
  ALG: [3, 10, 11, 12, 16, 18],
  AUT: [2, 3, 4, 7, 14, 18],
  JOR: [1, 7, 13, 15, 16, 17, 20],
  COD: [2, 4, 8, 9, 10, 12, 13, 14, 17, 18],
  UZB: [1, 2, 3, 6],
  COL: [6],
  ENG: [1, 9, 15, 19],
  CRO: [2, 4, 19],
  GHA: [4, 10, 12, 19],
  PAN: [19],
  CC: [2, 3, 5, 7, 8, 9, 12, 14],
};

const groupColors: Record<string, string> = {
  A: '#f59e0b',
  B: '#22c55e',
  C: '#06b6d4',
  D: '#3b82f6',
  E: '#ef4444',
  F: '#f97316',
  G: '#eab308',
  H: '#84cc16',
  I: '#14b8a6',
  J: '#0ea5e9',
  K: '#6366f1',
  L: '#ec4899',
  Extras: '#94a3b8',
};

const albumRows: AlbumRow[] = [
  { id: 'PGI', group: 'Extras', country: 'Página inicial', prefix: 'FWC', total: 8, firstCodeZero: true },
  { id: 'MEX', group: 'A', country: 'México', prefix: 'MEX', total: 20 },
  { id: 'RSA', group: 'A', country: 'África do Sul', prefix: 'RSA', total: 20 },
  { id: 'KOR', group: 'A', country: 'Coreia do Sul', prefix: 'KOR', total: 20 },
  { id: 'CZE', group: 'A', country: 'Rep. Tcheca', prefix: 'CZE', total: 20 },
  { id: 'CAN', group: 'B', country: 'Canadá', prefix: 'CAN', total: 20 },
  { id: 'BIH', group: 'B', country: 'Bósnia', prefix: 'BIH', total: 20 },
  { id: 'QAT', group: 'B', country: 'Catar', prefix: 'QAT', total: 20 },
  { id: 'SUI', group: 'B', country: 'Suíça', prefix: 'SUI', total: 20 },
  { id: 'BRA', group: 'C', country: 'Brasil', prefix: 'BRA', total: 20 },
  { id: 'MAR', group: 'C', country: 'Marrocos', prefix: 'MAR', total: 20 },
  { id: 'HAI', group: 'C', country: 'Haiti', prefix: 'HAI', total: 20 },
  { id: 'SCO', group: 'C', country: 'Escócia', prefix: 'SCO', total: 20 },
  { id: 'USA', group: 'D', country: 'Estados Unidos', prefix: 'USA', total: 20 },
  { id: 'PAR', group: 'D', country: 'Paraguai', prefix: 'PAR', total: 20 },
  { id: 'AUS', group: 'D', country: 'Austrália', prefix: 'AUS', total: 20 },
  { id: 'TUR', group: 'D', country: 'Turquia', prefix: 'TUR', total: 20 },
  { id: 'GER', group: 'E', country: 'Alemanha', prefix: 'GER', total: 20 },
  { id: 'CUW', group: 'E', country: 'Curaçau', prefix: 'CUW', total: 20 },
  { id: 'CIV', group: 'E', country: 'Costa do Marfim', prefix: 'CIV', total: 20 },
  { id: 'ECU', group: 'E', country: 'Equador', prefix: 'ECU', total: 20 },
  { id: 'NED', group: 'F', country: 'Holanda', prefix: 'NED', total: 20 },
  { id: 'JPN', group: 'F', country: 'Japão', prefix: 'JPN', total: 20 },
  { id: 'SWE', group: 'F', country: 'Suécia', prefix: 'SWE', total: 20 },
  { id: 'TUN', group: 'F', country: 'Tunísia', prefix: 'TUN', total: 20 },
  { id: 'BEL', group: 'G', country: 'Bélgica', prefix: 'BEL', total: 20 },
  { id: 'EGY', group: 'G', country: 'Egito', prefix: 'EGY', total: 20 },
  { id: 'IRN', group: 'G', country: 'Irã', prefix: 'IRN', total: 20 },
  { id: 'NZL', group: 'G', country: 'Nova Zelândia', prefix: 'NZL', total: 20 },
  { id: 'ESP', group: 'H', country: 'Espanha', prefix: 'ESP', total: 20 },
  { id: 'CPV', group: 'H', country: 'Cabo Verde', prefix: 'CPV', total: 20 },
  { id: 'KSA', group: 'H', country: 'Arábia Saudita', prefix: 'KSA', total: 20 },
  { id: 'URU', group: 'H', country: 'Uruguai', prefix: 'URU', total: 20 },
  { id: 'FRA', group: 'I', country: 'França', prefix: 'FRA', total: 20 },
  { id: 'SEN', group: 'I', country: 'Senegal', prefix: 'SEN', total: 20 },
  { id: 'IRQ', group: 'I', country: 'Iraque', prefix: 'IRQ', total: 20 },
  { id: 'NOR', group: 'I', country: 'Noruega', prefix: 'NOR', total: 20 },
  { id: 'ARG', group: 'J', country: 'Argentina', prefix: 'ARG', total: 20 },
  { id: 'ALG', group: 'J', country: 'Argélia', prefix: 'ALG', total: 20 },
  { id: 'AUT', group: 'J', country: 'Áustria', prefix: 'AUT', total: 20 },
  { id: 'JOR', group: 'J', country: 'Jordânia', prefix: 'JOR', total: 20 },
  { id: 'POR', group: 'K', country: 'Portugal', prefix: 'POR', total: 20 },
  { id: 'COD', group: 'K', country: 'Congo', prefix: 'COD', total: 20 },
  { id: 'UZB', group: 'K', country: 'Uzbequistão', prefix: 'UZB', total: 20 },
  { id: 'COL', group: 'K', country: 'Colômbia', prefix: 'COL', total: 20 },
  { id: 'ENG', group: 'L', country: 'Inglaterra', prefix: 'ENG', total: 20 },
  { id: 'CRO', group: 'L', country: 'Croácia', prefix: 'CRO', total: 20 },
  { id: 'GHA', group: 'L', country: 'Gana', prefix: 'GHA', total: 20 },
  { id: 'PAN', group: 'L', country: 'Panamá', prefix: 'PAN', total: 20 },
  { id: 'FWC', group: 'Extras', country: 'Fifa World Cup History', prefix: 'FWC', total: 12, startAt: 8 },
  { id: 'CC', group: 'Extras', country: 'Coca-Cola', prefix: 'CC', total: 14 },
];

const countryFlagsById: Record<string, string> = {
  PGI: '🌍',
  MEX: '🇲🇽',
  RSA: '🇿🇦',
  KOR: '🇰🇷',
  CZE: '🇨🇿',
  CAN: '🇨🇦',
  BIH: '🇧🇦',
  QAT: '🇶🇦',
  SUI: '🇨🇭',
  BRA: '🇧🇷',
  MAR: '🇲🇦',
  HAI: '🇭🇹',
  SCO: '🏴',
  USA: '🇺🇸',
  PAR: '🇵🇾',
  AUS: '🇦🇺',
  TUR: '🇹🇷',
  GER: '🇩🇪',
  CUW: '🇨🇼',
  CIV: '🇨🇮',
  ECU: '🇪🇨',
  NED: '🇳🇱',
  JPN: '🇯🇵',
  SWE: '🇸🇪',
  TUN: '🇹🇳',
  BEL: '🇧🇪',
  EGY: '🇪🇬',
  IRN: '🇮🇷',
  NZL: '🇳🇿',
  ESP: '🇪🇸',
  CPV: '🇨🇻',
  KSA: '🇸🇦',
  URU: '🇺🇾',
  FRA: '🇫🇷',
  SEN: '🇸🇳',
  IRQ: '🇮🇶',
  NOR: '🇳🇴',
  ARG: '🇦🇷',
  ALG: '🇩🇿',
  AUT: '🇦🇹',
  JOR: '🇯🇴',
  POR: '🇵🇹',
  COD: '🇨🇩',
  UZB: '🇺🇿',
  COL: '🇨🇴',
  ENG: '🏴',
  CRO: '🇭🇷',
  GHA: '🇬🇭',
  PAN: '🇵🇦',
  FWC: '🏆',
  CC: '🥤',
};

const countryFlagUriById: Record<string, string> = {
  MEX: 'https://flagcdn.com/w40/mx.png',
  RSA: 'https://flagcdn.com/w40/za.png',
  KOR: 'https://flagcdn.com/w40/kr.png',
  CZE: 'https://flagcdn.com/w40/cz.png',
  CAN: 'https://flagcdn.com/w40/ca.png',
  BIH: 'https://flagcdn.com/w40/ba.png',
  QAT: 'https://flagcdn.com/w40/qa.png',
  SUI: 'https://flagcdn.com/w40/ch.png',
  BRA: 'https://flagcdn.com/w40/br.png',
  MAR: 'https://flagcdn.com/w40/ma.png',
  HAI: 'https://flagcdn.com/w40/ht.png',
  SCO: 'https://flagcdn.com/w40/gb.png',
  USA: 'https://flagcdn.com/w40/us.png',
  PAR: 'https://flagcdn.com/w40/py.png',
  AUS: 'https://flagcdn.com/w40/au.png',
  TUR: 'https://flagcdn.com/w40/tr.png',
  GER: 'https://flagcdn.com/w40/de.png',
  CUW: 'https://flagcdn.com/w40/cw.png',
  CIV: 'https://flagcdn.com/w40/ci.png',
  ECU: 'https://flagcdn.com/w40/ec.png',
  NED: 'https://flagcdn.com/w40/nl.png',
  JPN: 'https://flagcdn.com/w40/jp.png',
  SWE: 'https://flagcdn.com/w40/se.png',
  TUN: 'https://flagcdn.com/w40/tn.png',
  BEL: 'https://flagcdn.com/w40/be.png',
  EGY: 'https://flagcdn.com/w40/eg.png',
  IRN: 'https://flagcdn.com/w40/ir.png',
  NZL: 'https://flagcdn.com/w40/nz.png',
  ESP: 'https://flagcdn.com/w40/es.png',
  CPV: 'https://flagcdn.com/w40/cv.png',
  KSA: 'https://flagcdn.com/w40/sa.png',
  URU: 'https://flagcdn.com/w40/uy.png',
  FRA: 'https://flagcdn.com/w40/fr.png',
  SEN: 'https://flagcdn.com/w40/sn.png',
  IRQ: 'https://flagcdn.com/w40/iq.png',
  NOR: 'https://flagcdn.com/w40/no.png',
  ARG: 'https://flagcdn.com/w40/ar.png',
  ALG: 'https://flagcdn.com/w40/dz.png',
  AUT: 'https://flagcdn.com/w40/at.png',
  JOR: 'https://flagcdn.com/w40/jo.png',
  POR: 'https://flagcdn.com/w40/pt.png',
  COD: 'https://flagcdn.com/w40/cd.png',
  UZB: 'https://flagcdn.com/w40/uz.png',
  COL: 'https://flagcdn.com/w40/co.png',
  ENG: 'https://flagcdn.com/w40/gb.png',
  CRO: 'https://flagcdn.com/w40/hr.png',
  GHA: 'https://flagcdn.com/w40/gh.png',
  PAN: 'https://flagcdn.com/w40/pa.png',
};

function flagForRow(row: AlbumRow) {
  return countryFlagsById[row.id] ?? '🏳️';
}

function buildCodes(row: AlbumRow) {
  const startAt = row.startAt ?? 1;

  if (row.firstCodeZero) {
    return [
      '00',
      ...Array.from(
        { length: row.total - 1 },
        (_, index) => `${row.prefix}${String(startAt + index).padStart(2, '0')}`,
      ),
    ];
  }

  return Array.from(
    { length: row.total },
    (_, index) => `${row.prefix}${String(startAt + index).padStart(2, '0')}`,
  );
}

function buildCodeFromAlbumNumber(row: AlbumRow, albumNumber: number) {
  if (row.firstCodeZero && albumNumber === 0) {
    return '00';
  }

  return `${row.prefix}${String(albumNumber).padStart(2, '0')}`;
}

function buildSeededCodeCounts() {
  const missingCodes = new Set<string>();

  for (const row of albumRows) {
    const missingNumbers = seededMissingByRowId[row.id] ?? [];
    for (const albumNumber of missingNumbers) {
      missingCodes.add(buildCodeFromAlbumNumber(row, albumNumber));
    }
  }

  return Object.fromEntries(
    albumRows
      .flatMap((row) => buildCodes(row))
      .filter((code) => !missingCodes.has(code))
      .map((code) => [code, 1]),
  ) as Record<string, number>;
}

const seededCodeCounts = buildSeededCodeCounts();

function chipLabel(code: string) {
  return code;
}

function isGoldenSticker(code: string) {
  return code === '00' || code.startsWith('FWC') || code.endsWith('01');
}

function isShinySticker(code: string) {
  if (code === '00' || code.startsWith('FWC')) {
    return true;
  }

  return code.endsWith('01') && !code.startsWith('CC');
}

function isCocaSticker(code: string) {
  return code.startsWith('CC');
}

function shareCodeLabel(code: string) {
  return code;
}

function shareRowHeader(row: AlbumRow) {
  return `${flagForRow(row)} ${row.country}`;
}

function groupCodesByAlbumOrder(codes: string[]) {
  const codeSet = new Set(codes);

  return albumRows
    .map((row) => {
      const items = buildCodes(row).filter((code) => codeSet.has(code));
      return { row, items };
    })
    .filter((entry) => entry.items.length > 0);
}

function encodeMissingSetHex(missingSet: Set<string>, allCodes: string[]) {
  const byteLength = Math.ceil(allCodes.length / 8);
  const bytes = new Uint8Array(byteLength);

  for (let index = 0; index < allCodes.length; index += 1) {
    if (!missingSet.has(allCodes[index])) {
      continue;
    }

    const byteIndex = Math.floor(index / 8);
    const bitOffset = index % 8;
    bytes[byteIndex] |= 1 << bitOffset;
  }

  return Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('');
}

function decodeMissingSetHex(hex: string, allCodes: string[]) {
  const normalized = hex.trim().toLowerCase();
  if (!normalized) {
    return new Set<string>();
  }

  const bytes = new Uint8Array(Math.ceil(normalized.length / 2));
  for (let index = 0; index < bytes.length; index += 1) {
    const chunk = normalized.slice(index * 2, index * 2 + 2);
    const value = Number.parseInt(chunk || '00', 16);
    bytes[index] = Number.isFinite(value) ? value : 0;
  }

  const missing = new Set<string>();

  for (let index = 0; index < allCodes.length; index += 1) {
    const byteIndex = Math.floor(index / 8);
    const bitOffset = index % 8;
    if (((bytes[byteIndex] ?? 0) & (1 << bitOffset)) !== 0) {
      missing.add(allCodes[index]);
    }
  }

  return missing;
}

export default function App() {
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;

  const defaultExpandedRowMap = useMemo(
    () => Object.fromEntries(albumRows.map((row) => [row.id, true])),
    [],
  );

  const [session, setSession] = useState<Session | null>(null);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authFeedback, setAuthFeedback] = useState('');
  const [authPending, setAuthPending] = useState(false);
  const [cloudStatus, setCloudStatus] = useState('');
  const [cloudHydrated, setCloudHydrated] = useState(false);

  const [activeTab, setActiveTab] = useState<'controle' | 'estatistica' | 'repetidas' | 'faltantes' | 'troca'>('controle');
  const [search, setSearch] = useState('');
  const [groupFilter, setGroupFilter] = useState<GroupFilter>('Todos');
  const [codeCounts, setCodeCounts] = useState<Record<string, number>>({});
  const [shareScope, setShareScope] = useState<ShareScope>('ambas');
  const [showQrCode, setShowQrCode] = useState(false);
  const [shareFeedback, setShareFeedback] = useState('');
  const [pendingShareTarget, setPendingShareTarget] = useState<ShareTarget | null>(null);
  const [qrInput, setQrInput] = useState('');
  const [parsedQrData, setParsedQrData] = useState<ParsedQrData | null>(null);
  const [qrFeedback, setQrFeedback] = useState('');
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannerReadyAt, setScannerReadyAt] = useState(0);
  const [scannerLocked, setScannerLocked] = useState(false);
  const [scannerError, setScannerError] = useState('');
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [expandedRowMap, setExpandedRowMap] = useState<Record<string, boolean>>(defaultExpandedRowMap);

  const isIosWeb = Platform.OS === 'web' && /iPad|iPhone|iPod/i.test((globalThis as any)?.navigator?.userAgent ?? '');

  const allCodes = useMemo(() => albumRows.flatMap((row) => buildCodes(row)), []);

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();

    return albumRows.filter((row) => {
      const matchesGroup = groupFilter === 'Todos' ? true : row.group === groupFilter;
      const matchesQuery = !query
        ? true
        : [row.country, row.prefix, row.group]
            .join(' ')
            .toLowerCase()
            .includes(query);

      return matchesGroup && matchesQuery;
    });
  }, [groupFilter, search]);

  const stats = useMemo(() => {
    const collected = allCodes.filter((code) => (codeCounts[code] ?? 0) > 0).length;
    const shinyCodes = allCodes.filter((code) => isShinySticker(code));
    const cocaCodes = allCodes.filter((code) => isCocaSticker(code));
    const shinyCollected = shinyCodes.filter((code) => (codeCounts[code] ?? 0) > 0).length;
    const cocaCollected = cocaCodes.filter((code) => (codeCounts[code] ?? 0) > 0).length;
    const duplicates = allCodes.reduce((acc, code) => {
      const qty = codeCounts[code] ?? 0;
      return acc + Math.max(0, qty - 1);
    }, 0);
    const total = allCodes.length;

    return {
      collected,
      missing: total - collected,
      progress: Math.round((collected / total) * 100),
      duplicates,
      total,
      shinyCollected,
      shinyTotal: shinyCodes.length,
      cocaCollected,
      cocaTotal: cocaCodes.length,
    };
  }, [allCodes, codeCounts]);

  useEffect(() => {
    let cancelled = false;

    const loadSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (!cancelled) {
        setSession(data.session ?? null);
      }
    };

    loadSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession ?? null);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session?.user?.id) {
      setCloudHydrated(false);
      return;
    }

    let cancelled = false;

    const loadCloudState = async () => {
      setCloudStatus('Carregando progresso da nuvem...');

      const { data, error } = await supabase
        .from('album_states')
        .select('code_counts, active_tab, search, group_filter, share_scope, show_qr_code, expanded_row_map')
        .eq('user_id', session.user.id)
        .maybeSingle();

      if (cancelled) {
        return;
      }

      if (error) {
        setCloudStatus('Erro ao carregar da nuvem.');
        setCloudHydrated(false);
        return;
      }

      const row = data as CloudAlbumStateRow | null;
      if (row) {
        setCodeCounts(row.code_counts ?? {});
        setActiveTab(row.active_tab ?? 'controle');
        setSearch(row.search ?? '');
        setGroupFilter(row.group_filter ?? 'Todos');
        setShareScope(row.share_scope ?? 'ambas');
        setShowQrCode(Boolean(row.show_qr_code));
        setExpandedRowMap(row.expanded_row_map ?? defaultExpandedRowMap);
      } else {
        // Conta sem estado salvo na nuvem deve iniciar com album zerado.
        setCodeCounts({});
        setActiveTab('controle');
        setSearch('');
        setGroupFilter('Todos');
        setShareScope('ambas');
        setShowQrCode(false);
        setExpandedRowMap(defaultExpandedRowMap);
      }

      setCloudStatus('Nuvem conectada.');
      setCloudHydrated(true);
    };

    loadCloudState();

    return () => {
      cancelled = true;
    };
  }, [defaultExpandedRowMap, session?.user?.id]);

  useEffect(() => {
    if (!session?.user?.id || !cloudHydrated) {
      return;
    }

    const syncTimer = setTimeout(async () => {
      const payload: PersistedAppState = {
        codeCounts,
        activeTab,
        search,
        groupFilter,
        shareScope,
        showQrCode,
        expandedRowMap,
      };

      const { error } = await supabase.from('album_states').upsert({
        user_id: session.user.id,
        code_counts: payload.codeCounts,
        active_tab: payload.activeTab,
        search: payload.search,
        group_filter: payload.groupFilter,
        share_scope: payload.shareScope,
        show_qr_code: payload.showQrCode,
        expanded_row_map: payload.expandedRowMap,
        updated_at: new Date().toISOString(),
      });

      setCloudStatus(error ? 'Falha ao salvar na nuvem.' : 'Progresso salvo na nuvem.');
    }, 500);

    return () => clearTimeout(syncTimer);
  }, [
    activeTab,
    cloudHydrated,
    codeCounts,
    expandedRowMap,
    groupFilter,
    search,
    session?.user?.id,
    shareScope,
    showQrCode,
  ]);

  const repeatedGroups = useMemo(() => {
    return albumRows
      .map((row) => {
        const items = buildCodes(row)
          .map((code) => ({ code, amount: Math.max(0, (codeCounts[code] ?? 0) - 1) }))
          .filter((item) => item.amount > 0);

        return { row, items };
      })
      .filter((entry) => entry.items.length > 0);
  }, [codeCounts]);

  const missingGroups = useMemo(() => {
    return albumRows
      .map((row) => {
        const items = buildCodes(row).filter((code) => (codeCounts[code] ?? 0) === 0);

        return { row, items };
      })
      .filter((entry) => entry.items.length > 0);
  }, [codeCounts]);

  const repeatedCompact = useMemo(
    () =>
      repeatedGroups.flatMap((entry) =>
        entry.items.map((item) => `${item.code}:${item.amount}`),
      ),
    [repeatedGroups],
  );

  const myRepeatedMap = useMemo(() => {
    return Object.fromEntries(repeatedGroups.flatMap((entry) => entry.items.map((item) => [item.code, item.amount])));
  }, [repeatedGroups]);

  const myMissingSet = useMemo(() => {
    return new Set(missingGroups.flatMap((entry) => entry.items));
  }, [missingGroups]);

  const missingCompact = useMemo(
    () =>
      missingGroups.flatMap((entry) =>
        entry.items.map((code) => code),
      ),
    [missingGroups],
  );

  const formatCodesByLines = (labels: string[]) => {
    const lines: string[] = [];

    for (let index = 0; index < labels.length; index += 10) {
      lines.push(labels.slice(index, index + 10).join(' | '));
    }

    return lines.join('\n');
  };

  const repeatedFormatted = useMemo(() => {
    return repeatedGroups
      .map((entry) => {
        const header = shareRowHeader(entry.row);
        const labels = entry.items.map((item) => `${shareCodeLabel(item.code)}${item.amount > 1 ? ` X${item.amount}` : ''}`);
        return `${header}\n${formatCodesByLines(labels)}`;
      })
      .join('\n\n');
  }, [repeatedGroups]);

  const missingFormatted = useMemo(() => {
    return missingGroups
      .map((entry) => {
        const header = shareRowHeader(entry.row);
        const labels = entry.items.map((code) => shareCodeLabel(code));
        return `${header}\n${formatCodesByLines(labels)}`;
      })
      .join('\n\n');
  }, [missingGroups]);

  const sectionText = (title: string, content: string, emptyText: string) => {
    return `${title}:\n${content || emptyText}`;
  };

  const getScopeShareData = (scope: ShareScope) => {
    const scopeLabel = scope === 'repetidas' ? 'Somente repetidas' : scope === 'faltantes' ? 'Somente faltantes' : 'Repetidas e faltantes';

    const repeatedSection = sectionText('Repetidas', repeatedFormatted, 'Nenhuma repetida');
    const missingSection = sectionText('Faltantes', missingFormatted, 'Nenhuma faltante');

    const shareBody =
      scope === 'repetidas'
        ? repeatedSection
        : scope === 'faltantes'
          ? missingSection
          : `${repeatedSection}\n\n${missingSection}`;

    const shareText = `✦ FIGURINHAS - ÁLBUM COPA 2026 ✦\n\n${shareBody}`;

    const missingHex = encodeMissingSetHex(new Set(missingGroups.flatMap((entry) => entry.items)), allCodes);
    const compactQrData =
      scope === 'repetidas'
        ? `ALBUM2|R|R:${repeatedCompact.join(';') || 'none'}`
        : scope === 'faltantes'
          ? `ALBUM2|F|M:${missingHex}`
          : `ALBUM2|A|R:${repeatedCompact.join(';') || 'none'}|M:${missingHex}`;

    const canShareSelection =
      scope === 'repetidas'
        ? repeatedCompact.length > 0
        : scope === 'faltantes'
          ? missingCompact.length > 0
          : repeatedCompact.length > 0 || missingCompact.length > 0;

    return {
      canShareSelection,
      shareText,
      qrPayload: compactQrData,
    };
  };

  const scopeShareData = useMemo(() => getScopeShareData(shareScope), [missingCompact, repeatedCompact, shareScope]);

  const { canShareSelection, qrPayload } = scopeShareData;
  const hasAnyShareData = repeatedCompact.length > 0 || missingCompact.length > 0;

  const groups = ['Todos', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'Extras'] as const;

  const incrementCode = (code: string) => {
    setCodeCounts((current) => ({
      ...current,
      [code]: (current[code] ?? 0) + 1,
    }));
  };

  const decrementCode = (code: string) => {
    setCodeCounts((current) => {
      const value = Math.max(0, (current[code] ?? 0) - 1);
      return { ...current, [code]: value };
    });
  };

  const clearAllRepeated = () => {
    setCodeCounts((current) => {
      const next = { ...current };

      for (const code of Object.keys(next)) {
        if ((next[code] ?? 0) > 1) {
          next[code] = 1;
        }
      }

      return next;
    });
  };

  const clearAllAlbumData = () => {
    setCodeCounts({});
    setShowQrCode(false);
    setShareFeedback('');
  };

  const copyPayloadToClipboard = async (payload: string) => {
    try {
      await Clipboard.setStringAsync(payload);
      return true;
    } catch {
      try {
        const clipboardApi = (globalThis as any)?.navigator?.clipboard;
        if (clipboardApi?.writeText) {
          await clipboardApi.writeText(payload);
          return true;
        }
      } catch {
        // fallback abaixo
      }

      try {
        const doc = (globalThis as any)?.document;
        if (!doc) {
          return false;
        }

        const textarea = doc.createElement('textarea');
        textarea.value = payload;
        textarea.setAttribute('readonly', 'true');
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        doc.body.appendChild(textarea);
        textarea.select();
        const success = doc.execCommand('copy');
        doc.body.removeChild(textarea);
        return Boolean(success);
      } catch {
        return false;
      }
    }
  };

  const runShareAction = async (target: ShareTarget, scope: ShareScope) => {
    const data = getScopeShareData(scope);

    if (!data.canShareSelection) {
      setShareFeedback('Sem itens nesse filtro para compartilhar.');
      setPendingShareTarget(null);
      return;
    }

    const payload = data.shareText;
    const copied = await copyPayloadToClipboard(payload);

    let opened = false;

    try {
      if (target === 'share') {
        await Share.share({ message: payload });
        opened = true;
      }

      if (target === 'whatsapp') {
        const url = `https://wa.me/?text=${encodeURIComponent(payload)}`;
        await Linking.openURL(url);
        opened = true;
      }

      if (target === 'mail') {
        const subject = 'Troca de figurinhas - Álbum Copa 2026';
        const url = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(payload)}`;
        await Linking.openURL(url);
        opened = true;
      }
    } catch {
      // feedback consolidado abaixo
    }

    if (copied && opened) {
      setShareFeedback('Conteúdo copiado e envio aberto.');
    } else if (copied) {
      setShareFeedback('Conteúdo copiado para a área de transferência.');
    } else if (opened) {
      setShareFeedback('Envio aberto, mas não foi possível copiar automaticamente.');
    } else {
      setShareFeedback('Não foi possível copiar nem abrir o envio neste ambiente.');
    }

    setPendingShareTarget(null);
  };

  const runCopyOnly = async (scope: ShareScope) => {
    const data = getScopeShareData(scope);

    if (!data.canShareSelection) {
      setShareFeedback('Sem itens nesse filtro para copiar.');
      setPendingShareTarget(null);
      return;
    }

    const payload = data.shareText;
    const copied = await copyPayloadToClipboard(payload);

    setShareFeedback(copied ? 'Conteúdo copiado para a área de transferência.' : 'Não foi possível copiar neste ambiente.');
    setPendingShareTarget(null);
  };

  const normalizeQrPayload = (rawInput: string) => {
    let value = rawInput.trim();
    if (!value) {
      return '';
    }

    try {
      if (value.startsWith('http://') || value.startsWith('https://')) {
        const url = new URL(value);
        const dataParam = url.searchParams.get('data');
        if (dataParam) {
          value = dataParam;
        }
      }
    } catch {
      // manter valor original
    }

    try {
      value = decodeURIComponent(value);
    } catch {
      // manter valor original
    }

    const albumPos = value.indexOf('ALBUM|');
    if (albumPos >= 0) {
      value = value.slice(albumPos);
    }

    return value.trim();
  };

  const parseRepeatedChunk = (chunk: string) => {
    const result: Record<string, number> = {};
    if (!chunk || chunk === 'none') {
      return result;
    }

    for (const item of chunk.split(';')) {
      const [code, qtyText] = item.split(':');
      if (!code) {
        continue;
      }

      const qty = Number.parseInt(qtyText ?? '1', 10);
      result[code] = Number.isFinite(qty) && qty > 0 ? qty : 1;
    }

    return result;
  };

  const parseMissingChunk = (chunk: string) => {
    if (!chunk || chunk === 'none') {
      return new Set<string>();
    }

    return new Set(chunk.split(';').filter(Boolean));
  };

  const parseQrPayload = (payload: string): ParsedQrData | null => {
    const normalized = normalizeQrPayload(payload);
    if (normalized.startsWith('ALBUM2|')) {
      const parts = normalized.split('|');
      if (parts.length < 3) {
        return null;
      }

      const scope = parts[1] as ParsedQrData['scope'];
      if (!['R', 'F', 'A'].includes(scope)) {
        return null;
      }

      const repeatedPart = parts.find((part) => part.startsWith('R:'))?.slice(2) ?? 'none';
      const missingPart = parts.find((part) => part.startsWith('M:'))?.slice(2) ?? '';

      if (scope === 'R') {
        return {
          scope,
          repeated: parseRepeatedChunk(repeatedPart),
          missing: new Set<string>(),
        };
      }

      if (!missingPart) {
        return null;
      }

      return {
        scope,
        repeated: scope === 'F' ? {} : parseRepeatedChunk(repeatedPart),
        missing: decodeMissingSetHex(missingPart, allCodes),
      };
    }

    if (!normalized.startsWith('ALBUM|')) {
      return null;
    }

    const parts = normalized.split('|');
    if (parts.length < 3) {
      return null;
    }

    const scope = parts[1] as ParsedQrData['scope'];
    if (!['R', 'F', 'A'].includes(scope)) {
      return null;
    }

    if (scope === 'R') {
      return {
        scope,
        repeated: parseRepeatedChunk(parts[2] ?? 'none'),
        missing: new Set<string>(),
      };
    }

    if (scope === 'F') {
      return {
        scope,
        repeated: {},
        missing: parseMissingChunk(parts[2] ?? 'none'),
      };
    }

    const repeatedPart = parts.find((part) => part.startsWith('R:'))?.slice(2) ?? 'none';
    const missingPart = parts.find((part) => part.startsWith('F:'))?.slice(2) ?? 'none';

    return {
      scope,
      repeated: parseRepeatedChunk(repeatedPart),
      missing: parseMissingChunk(missingPart),
    };
  };

  const onReadQrPayload = () => {
    const parsed = parseQrPayload(qrInput);
    if (!parsed) {
      setParsedQrData(null);
      setQrFeedback('QR inválido. Cole o valor ALBUM|... ou o link do QR.');
      return;
    }

    setParsedQrData(parsed);
    setQrFeedback('QR lido com sucesso. Comparação pronta.');
  };

  const onOpenExternalCamera = async () => {
    if (Platform.OS !== 'web') {
      setQrFeedback('Este modo está disponível apenas no navegador.');
      return;
    }

    const doc = (globalThis as any)?.document;
    if (!doc) {
      setQrFeedback('Não foi possível abrir a câmera externa neste ambiente.');
      return;
    }

    const input = doc.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment';
    input.style.position = 'fixed';
    input.style.left = '-9999px';
    doc.body.appendChild(input);

    input.onchange = async () => {
      try {
        const file = input.files?.[0];
        if (!file) {
          setQrFeedback('Nenhuma imagem selecionada.');
          return;
        }

        const BarcodeDetectorCtor = (globalThis as any)?.BarcodeDetector;
        if (!BarcodeDetectorCtor) {
          setQrFeedback('Seu navegador não suporta leitura por foto. Use Ler com câmera ou Ler texto colado.');
          return;
        }

        const detector = new BarcodeDetectorCtor({ formats: ['qr_code'] });
        const imageUrl = URL.createObjectURL(file);

        try {
          const BrowserImage = (globalThis as any).Image;
          const img = new BrowserImage();
          img.src = imageUrl;
          await img.decode();
          const result = await detector.detect(img);
          const payload = result?.[0]?.rawValue;

          if (!payload) {
            setParsedQrData(null);
            setQrFeedback('Não foi possível identificar QR na foto. Tente novamente.');
            return;
          }

          setQrInput(payload);
          const parsed = parseQrPayload(payload);
          if (!parsed) {
            setParsedQrData(null);
            setQrFeedback('QR da foto é inválido.');
            return;
          }

          setParsedQrData(parsed);
          setQrFeedback('QR lido com sucesso pela foto. Comparação pronta.');
        } finally {
          URL.revokeObjectURL(imageUrl);
        }
      } catch {
        setQrFeedback('Falha ao ler QR pela foto.');
      } finally {
        doc.body.removeChild(input);
      }
    };

    input.click();
  };

  const onOpenScanner = async () => {
    try {
      if (!cameraPermission?.granted) {
        const response = await requestCameraPermission();
        if (!response.granted) {
          setScannerError('Permissão de câmera negada.');
          setQrFeedback(
            isIosWeb
              ? 'Permissão de câmera negada no iPhone. Libere em Ajustes > Safari > Câmera ou use a opção de colar o QR.'
              : 'Permissão de câmera negada. Use a opção de colar o QR.',
          );
          return;
        }
      }

      setScannerError('');
      setScannerLocked(false);
      setScannerReadyAt(Date.now() + 1200);
      setScannerOpen(true);
      setQrFeedback('Abrindo câmera... aponte para o QR.');
    } catch {
      setScannerError('Não foi possível inicializar a câmera neste dispositivo.');
      setQrFeedback('Falha ao abrir câmera. Use a opção de colar o QR.');
    }
  };

  const onScanQr = ({ data }: { data: string }) => {
    if (scannerLocked) {
      return;
    }

    if (Date.now() < scannerReadyAt) {
      return;
    }

    setScannerLocked(true);

    const parsed = parseQrPayload(data);
    if (!parsed) {
      setParsedQrData(null);
      setQrFeedback('QR inválido. Continue apontando para o QR ou cole o conteúdo.');
      setScannerLocked(false);
      return;
    }

    setQrInput(data);
    setParsedQrData(parsed);
    setQrFeedback('QR lido com sucesso pela câmera. Comparação pronta.');
    setScannerOpen(false);
  };

  const tradeComparison = useMemo(() => {
    if (!parsedQrData) {
      return null;
    }

    const theyNeedFromMe = Array.from(parsedQrData.missing)
      .filter((code) => (myRepeatedMap[code] ?? 0) > 0)
      .sort((a, b) => a.localeCompare(b));
    const iNeedFromThem = Array.from(myMissingSet)
      .filter((code) => (parsedQrData.repeated[code] ?? 0) > 0)
      .sort((a, b) => a.localeCompare(b));

    const groupedNeedFromMe = groupCodesByAlbumOrder(theyNeedFromMe);
    const groupedNeedFromThem = groupCodesByAlbumOrder(iNeedFromThem);
    const counterpartyMissing = Array.from(parsedQrData.missing).sort((a, b) => a.localeCompare(b));
    const groupedCounterpartyMissing = groupCodesByAlbumOrder(counterpartyMissing);

    return {
      theyNeedFromMe,
      iNeedFromThem,
      counterpartyMissing,
      groupedNeedFromMe,
      groupedNeedFromThem,
      groupedCounterpartyMissing,
      isCompleteForExchange: parsedQrData.scope === 'A',
    };
  }, [myMissingSet, myRepeatedMap, parsedQrData]);

  const onChangeShareScope = async (scope: ShareScope) => {
    setShareScope(scope);
    setShowQrCode(false);

    const data = getScopeShareData(scope);
    if (!data.canShareSelection) {
      setShareFeedback('Sem itens nesse filtro para copiar.');
      return;
    }

    const payload = data.shareText;
    const copied = await copyPayloadToClipboard(payload);
    setShareFeedback(copied ? 'Conteúdo copiado para a área de transferência.' : 'Não foi possível copiar neste ambiente.');
  };

  const resolveAuthErrorMessage = (error: AuthErrorLike | null, action: 'signin' | 'signup') => {
    if (!error) {
      return action === 'signin' ? 'Login realizado com sucesso.' : 'Conta criada. Confira seu e-mail para confirmar, se solicitado.';
    }

    const status = error.status;
    const code = (error.code ?? '').toLowerCase();
    const message = (error.message ?? '').toLowerCase();

    if (status === 429 || code.includes('over_') || message.includes('rate limit') || message.includes('too many')) {
      return 'Muitas tentativas agora. Aguarde 1-2 minutos e tente novamente.';
    }

    if (action === 'signup' && (message.includes('already registered') || message.includes('already been registered'))) {
      return 'Este e-mail já possui conta. Tente entrar ou recuperar a senha.';
    }

    if (action === 'signin' && (message.includes('email not confirmed') || message.includes('not confirmed'))) {
      return 'E-mail ainda não confirmado. Verifique sua caixa de entrada e spam.';
    }

    return action === 'signin'
      ? 'Falha no login. Confira e-mail e senha.'
      : 'Falha ao criar conta. Tente outro e-mail ou senha mais forte.';
  };

  const onSignInWithPassword = async () => {
    if (authPending) {
      return;
    }

    const email = authEmail.trim();
    if (!email || !authPassword) {
      setAuthFeedback('Digite e-mail e senha para entrar.');
      return;
    }

    setAuthPending(true);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: authPassword,
    });
    setAuthFeedback(resolveAuthErrorMessage(error as AuthErrorLike | null, 'signin'));
    setAuthPending(false);
  };

  const onCreateAccount = async () => {
    if (authPending) {
      return;
    }

    const email = authEmail.trim();
    if (!email || !authPassword) {
      setAuthFeedback('Digite e-mail e senha para criar a conta.');
      return;
    }

    const currentHref = (globalThis as any)?.location?.href;
    const emailRedirectTo = typeof currentHref === 'string' ? currentHref.split('#')[0] : undefined;

    setAuthPending(true);
    const { error } = await supabase.auth.signUp({
      email,
      password: authPassword,
      options: { emailRedirectTo },
    });
    setAuthFeedback(resolveAuthErrorMessage(error as AuthErrorLike | null, 'signup'));
    setAuthPending(false);
  };

  const onSignOut = async () => {
    await supabase.auth.signOut();
    setCloudHydrated(false);
    setCloudStatus('Sessão encerrada.');
    setAuthFeedback('Sessão encerrada.');
  };

  if (!session?.user) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.glowTop} />
        <View style={styles.glowBottom} />

        <View style={styles.authWrap}>
          <View style={styles.authCard}>
            <Text style={styles.authTitle}>Entrar no álbum</Text>
            <Text style={styles.authSubtitle}>Faça login para sincronizar seu progresso na nuvem.</Text>

            <TextInput
              value={authEmail}
              onChangeText={setAuthEmail}
              placeholder="Seu e-mail"
              placeholderTextColor="#94a3b8"
              autoCapitalize="none"
              keyboardType="email-address"
              style={styles.cloudInput}
            />

            <TextInput
              value={authPassword}
              onChangeText={setAuthPassword}
              placeholder="Sua senha"
              placeholderTextColor="#94a3b8"
              autoCapitalize="none"
              secureTextEntry
              style={styles.cloudInput}
            />

            <View style={styles.cloudButtonRow}>
              <Pressable
                onPress={onSignInWithPassword}
                disabled={authPending}
                style={[styles.cloudButtonPrimary, styles.cloudButtonHalf, authPending && styles.cloudButtonDisabled]}
              >
                <Text style={styles.cloudButtonPrimaryText}>{authPending ? 'Aguarde...' : 'Entrar'}</Text>
              </Pressable>
              <Pressable
                onPress={onCreateAccount}
                disabled={authPending}
                style={[styles.cloudButtonSecondary, styles.cloudButtonHalf, authPending && styles.cloudButtonDisabled]}
              >
                <Text style={styles.cloudButtonSecondaryText}>{authPending ? 'Aguarde...' : 'Criar conta'}</Text>
              </Pressable>
            </View>

            <Text style={styles.cloudHint}>Use o mesmo login no celular e no computador para manter tudo sincronizado.</Text>
            {authFeedback ? <Text style={styles.cloudStatus}>{authFeedback}</Text> : null}
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.glowTop} />
      <View style={styles.glowBottom} />

      <View style={[styles.appFrame, isTablet && styles.appFrameTablet]}>
      <View style={styles.sessionBar}>
        <Text style={styles.sessionEmail}>{session.user.email}</Text>
        <Pressable onPress={onSignOut} style={styles.sessionSignOutButton}>
          <Text style={styles.sessionSignOutText}>Sair</Text>
        </Pressable>
      </View>

      <View style={[styles.tabRow, isTablet && styles.tabRowTablet]}>
        <Pressable
          style={[styles.tabButton, isTablet && styles.tabButtonTablet, activeTab === 'controle' && styles.tabButtonActive]}
          onPress={() => setActiveTab('controle')}
        >
          <Text style={[styles.tabButtonText, activeTab === 'controle' && styles.tabButtonTextActive]}>Controle</Text>
        </Pressable>
        <Pressable
          style={[styles.tabButton, isTablet && styles.tabButtonTablet, activeTab === 'faltantes' && styles.tabButtonActive]}
          onPress={() => setActiveTab('faltantes')}
        >
          <Text style={[styles.tabButtonText, activeTab === 'faltantes' && styles.tabButtonTextActive]}>Faltantes</Text>
        </Pressable>
        <Pressable
          style={[styles.tabButton, isTablet && styles.tabButtonTablet, activeTab === 'repetidas' && styles.tabButtonActive]}
          onPress={() => setActiveTab('repetidas')}
        >
          <Text style={[styles.tabButtonText, activeTab === 'repetidas' && styles.tabButtonTextActive]}>
            Repetidas
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tabButton, isTablet && styles.tabButtonTablet, activeTab === 'estatistica' && styles.tabButtonActive]}
          onPress={() => setActiveTab('estatistica')}
        >
          <Text style={[styles.tabButtonText, activeTab === 'estatistica' && styles.tabButtonTextActive]}>
            Estatística
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tabButton, isTablet && styles.tabButtonTablet, activeTab === 'troca' && styles.tabButtonActive]}
          onPress={() => setActiveTab('troca')}
        >
          <Text style={[styles.tabButtonText, activeTab === 'troca' && styles.tabButtonTextActive]}>Troca QR</Text>
        </Pressable>
      </View>

      {activeTab === 'controle' ? (
        <FlatList
          data={filteredRows}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.content, isTablet && styles.contentTablet]}
          ListHeaderComponent={
            <View>
              <View style={styles.hero}>
                <Text style={styles.kicker}>CONTROLE DE FIGURINHAS</Text>
                <Text style={[styles.title, isTablet && styles.titleTablet]}>Álbum Copa 2026</Text>
              </View>

              <View style={styles.toolbar}>
                <TextInput
                  value={search}
                  onChangeText={setSearch}
                  placeholder="Buscar país, grupo ou código"
                  placeholderTextColor="#64748b"
                  style={styles.search}
                />

                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
                  {groups.map((group) => {
                    const active = groupFilter === group;
                    return (
                      <Pressable
                        key={group}
                        onPress={() => setGroupFilter(group)}
                        style={[styles.filterChip, active && styles.filterChipActive]}
                      >
                        <Text style={[styles.filterText, active && styles.filterTextActive]}>{group}</Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>

                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Tabela do álbum</Text>
                  <Text style={styles.sectionHint}>Toque para somar, segure para diminuir</Text>
                </View>
              </View>
            </View>
          }
          renderItem={({ item }) => {
            const codes = buildCodes(item);
            const collectedCount = codes.filter((code) => (codeCounts[code] ?? 0) > 0).length;
            const expanded = expandedRowMap[item.id] ?? true;
            const canCollapse = collectedCount === item.total;

            return (
              <Pressable
                onPress={() =>
                  setExpandedRowMap((current) => {
                    if (expanded && !canCollapse) {
                      return current;
                    }

                    return {
                      ...current,
                      [item.id]: !expanded,
                    };
                  })
                }
                style={styles.rowCard}
              >
                <View style={styles.rowTop}>
                  <View style={styles.rowTitleBlock}>
                    <View style={styles.countryRow}>
                      <FlagIcon rowId={item.id} fallback={flagForRow(item)} />
                      <Text style={[styles.country, isTablet && styles.countryTablet]}>{item.country}</Text>
                      {canCollapse ? <Text style={styles.completedMark}>✓</Text> : null}
                    </View>
                  </View>

                  {expanded ? (
                    <View style={styles.rowMeta}>
                      <Text style={styles.rowMetaValue}>{collectedCount}/{item.total}</Text>
                      <Text style={styles.rowMetaLabel}>colecionadas</Text>
                    </View>
                  ) : null}
                </View>

                {expanded ? (
                  <>
                    <View style={styles.rowProgressTrack}>
                      <View
                        style={[
                          styles.rowProgressFill,
                          {
                            width: `${(collectedCount / item.total) * 100}%`,
                            backgroundColor: groupColors[item.group],
                          },
                        ]}
                      />
                    </View>

                    <View style={styles.codeGrid}>
                      {codes.map((code) => {
                        const qty = codeCounts[code] ?? 0;
                        const collected = qty > 0;
                        const goldenMissing = !collected && isGoldenSticker(code);
                        const cocaMissing = !collected && isCocaSticker(code);

                        return (
                          <Pressable
                            key={code}
                            onPress={() => incrementCode(code)}
                            onLongPress={() => decrementCode(code)}
                            style={[
                              styles.codeChip,
                              isTablet && styles.codeChipTablet,
                              collected && styles.codeChipCollected,
                              goldenMissing && styles.codeChipGolden,
                              cocaMissing && styles.codeChipCoca,
                            ]}
                          >
                            <Text
                              style={[
                                styles.codeChipText,
                                isTablet && styles.codeChipTextTablet,
                                collected && styles.codeChipTextCollected,
                                goldenMissing && styles.codeChipTextGolden,
                                cocaMissing && styles.codeChipTextCoca,
                              ]}
                            >
                              {chipLabel(code)}{qty > 1 ? ` X${qty - 1}` : ''}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>

                    {canCollapse ? <Text style={styles.expandText}>Toque para recolher</Text> : null}
                  </>
                ) : null}
              </Pressable>
            );
          }}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={<Text style={styles.empty}>Nenhum resultado encontrado.</Text>}
        />
      ) : (
        <ScrollView contentContainerStyle={[styles.content, isTablet && styles.contentTablet]}>
          <View style={styles.hero}>
            <Text style={styles.kicker}>
              {activeTab === 'estatistica'
                ? 'ESTATÍSTICA'
                : activeTab === 'repetidas'
                  ? 'REPETIDAS'
                  : activeTab === 'faltantes'
                    ? 'FALTANTES'
                    : 'TROCA QR'}
            </Text>
            <Text style={[styles.title, isTablet && styles.titleTablet]}>Resumo do álbum</Text>

            {activeTab === 'estatistica' ? (
              <>
                <View style={styles.statsRow}>
                  <StatCard label="Coletadas" value={stats.collected.toString()} isTablet={isTablet} />
                  <StatCard label="Faltam" value={stats.missing.toString()} isTablet={isTablet} />
                  <StatCard label="Duplicadas" value={stats.duplicates.toString()} isTablet={isTablet} />
                  <StatCard label="Progresso" value={`${stats.progress}%`} isTablet={isTablet} />
                  <StatCard label="Brilhantes" value={`${stats.shinyCollected}/${stats.shinyTotal}`} isTablet={isTablet} />
                  <StatCard label="Coca-Cola" value={`${stats.cocaCollected}/${stats.cocaTotal}`} isTablet={isTablet} />
                </View>

                <View style={styles.progressBlock}>
                  <View style={styles.progressHeader}>
                    <Text style={styles.progressLabel}>Andamento geral</Text>
                    <Text style={styles.progressValue}>{stats.collected}/{stats.total}</Text>
                  </View>
                  <View style={styles.progressTrack}>
                    <View style={[styles.progressFill, { width: `${stats.progress}%` }]} />
                  </View>
                </View>

                <View style={styles.shareBlock}>
                  <Text style={styles.shareTitle}>Compartilhar para trocas</Text>

                  <View style={styles.shareScopeRow}>
                    <Pressable
                      onPress={() => onChangeShareScope('repetidas')}
                      style={[styles.shareScopeChip, shareScope === 'repetidas' && styles.shareScopeChipActive]}
                    >
                      <Text style={[styles.shareScopeText, shareScope === 'repetidas' && styles.shareScopeTextActive]}>
                        Repetidas
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => onChangeShareScope('faltantes')}
                      style={[styles.shareScopeChip, shareScope === 'faltantes' && styles.shareScopeChipActive]}
                    >
                      <Text style={[styles.shareScopeText, shareScope === 'faltantes' && styles.shareScopeTextActive]}>
                        Faltantes
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => onChangeShareScope('ambas')}
                      style={[styles.shareScopeChip, shareScope === 'ambas' && styles.shareScopeChipActive]}
                    >
                      <Text style={[styles.shareScopeText, shareScope === 'ambas' && styles.shareScopeTextActive]}>
                        Ambas
                      </Text>
                    </Pressable>
                  </View>

                  {showQrCode ? (
                    <View style={styles.qrContainer}>
                      {canShareSelection ? (
                        <View style={styles.qrLocalFrame}>
                          <QRCode value={qrPayload} size={180} backgroundColor="#ffffff" color="#111827" />
                        </View>
                      ) : (
                        <Text style={styles.empty}>Sem itens nesse filtro para gerar QR.</Text>
                      )}
                    </View>
                  ) : null}

                  <View style={styles.shareActionsRow}>
                    <Pressable
                      onPress={() => setShowQrCode((current) => !current)}
                      style={[styles.shareActionButton, !canShareSelection && styles.shareActionDisabled]}
                      disabled={!canShareSelection}
                    >
                      <Text style={styles.shareActionText}>{showQrCode ? 'Ocultar QR' : 'QR Code'}</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => setPendingShareTarget('share')}
                      style={[styles.shareActionButton, !hasAnyShareData && styles.shareActionDisabled]}
                      disabled={!hasAnyShareData}
                    >
                      <Text style={styles.shareActionText}>Compartilhar</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => setPendingShareTarget('whatsapp')}
                      style={[styles.shareActionButton, !hasAnyShareData && styles.shareActionDisabled]}
                      disabled={!hasAnyShareData}
                    >
                      <Text style={styles.shareActionText}>WhatsApp</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => setPendingShareTarget('mail')}
                      style={[styles.shareActionButton, !hasAnyShareData && styles.shareActionDisabled]}
                      disabled={!hasAnyShareData}
                    >
                      <Text style={styles.shareActionText}>E-mail</Text>
                    </Pressable>
                  </View>

                  {pendingShareTarget ? (
                    <View style={styles.scopePickerBlock}>
                      <Text style={styles.scopePickerTitle}>Enviar o que?</Text>
                      <View style={styles.scopePickerRow}>
                        <Pressable
                          onPress={() => runShareAction(pendingShareTarget, 'repetidas')}
                          style={styles.scopePickerButton}
                        >
                          <Text style={styles.scopePickerButtonText}>Repetidas</Text>
                        </Pressable>
                        <Pressable
                          onPress={() => runShareAction(pendingShareTarget, 'faltantes')}
                          style={styles.scopePickerButton}
                        >
                          <Text style={styles.scopePickerButtonText}>Faltantes</Text>
                        </Pressable>
                        <Pressable
                          onPress={() => runShareAction(pendingShareTarget, 'ambas')}
                          style={styles.scopePickerButton}
                        >
                          <Text style={styles.scopePickerButtonText}>Ambas</Text>
                        </Pressable>
                      </View>

                      <Text style={styles.scopePickerSubtitle}>Copiar agora:</Text>
                      <View style={styles.scopePickerRow}>
                        <Pressable
                          onPress={() => runCopyOnly('repetidas')}
                          style={styles.scopePickerCopyButton}
                        >
                          <Text style={styles.scopePickerButtonText}>Repetidas</Text>
                        </Pressable>
                        <Pressable
                          onPress={() => runCopyOnly('faltantes')}
                          style={styles.scopePickerCopyButton}
                        >
                          <Text style={styles.scopePickerButtonText}>Faltantes</Text>
                        </Pressable>
                        <Pressable
                          onPress={() => runCopyOnly('ambas')}
                          style={styles.scopePickerCopyButton}
                        >
                          <Text style={styles.scopePickerButtonText}>Ambas</Text>
                        </Pressable>
                      </View>

                      <Pressable onPress={() => setPendingShareTarget(null)} style={styles.scopePickerCancel}>
                        <Text style={styles.scopePickerCancelText}>Cancelar</Text>
                      </Pressable>
                    </View>
                  ) : null}

                  {shareFeedback ? <Text style={styles.shareFeedback}>{shareFeedback}</Text> : null}
                </View>

                <View style={styles.statsActionRow}>
                  <Pressable onPress={clearAllAlbumData} style={styles.clearAllButton}>
                    <Text style={styles.clearAllButtonText}>Limpar tudo</Text>
                  </Pressable>
                </View>
              </>
            ) : activeTab === 'repetidas' ? (
              <View style={styles.repeatedBlock}>
                <Text style={styles.repeatedTitle}>Figurinhas repetidas</Text>
                {repeatedGroups.length === 0 ? (
                  <Text style={styles.empty}>Nenhuma repetida ainda.</Text>
                ) : (
                  <View style={styles.repeatedList}>
                    {repeatedGroups.map((entry) => (
                      <View key={entry.row.id} style={styles.repeatedGroupCard}>
                        <View style={styles.repeatedHeaderRow}>
                          <FlagIcon rowId={entry.row.id} fallback={flagForRow(entry.row)} />
                          <View>
                            <Text style={styles.repeatedCountry}>{entry.row.country}</Text>
                          </View>
                        </View>

                        <View style={styles.repeatedCodesWrap}>
                          {entry.items.map((item) => (
                            <View key={item.code} style={styles.repeatedItem}>
                              <Text style={styles.repeatedCode}>{chipLabel(item.code)}</Text>
                              {item.amount > 1 ? <Text style={styles.repeatedQty}>X{item.amount}</Text> : null}
                            </View>
                          ))}
                        </View>
                      </View>
                    ))}
                  </View>
                )}

                <View style={styles.repeatedActionRow}>
                  <Pressable
                    onPress={clearAllRepeated}
                    disabled={repeatedGroups.length === 0}
                    style={[styles.repeatedClearButton, repeatedGroups.length === 0 && styles.repeatedClearButtonDisabled]}
                  >
                    <Text style={styles.repeatedClearButtonText}>Apagar todas repetidas</Text>
                  </Pressable>
                </View>
              </View>
            ) : activeTab === 'faltantes' ? (
              <View style={styles.repeatedBlock}>
                <Text style={styles.repeatedTitle}>Figurinhas faltantes</Text>
                {missingGroups.length === 0 ? (
                  <Text style={styles.empty}>Álbum completo. Nenhuma faltante.</Text>
                ) : (
                  <View style={styles.repeatedList}>
                    {missingGroups.map((entry) => (
                      <View key={entry.row.id} style={styles.repeatedGroupCard}>
                        <View style={styles.repeatedHeaderRow}>
                          <FlagIcon rowId={entry.row.id} fallback={flagForRow(entry.row)} />
                          <View>
                            <Text style={styles.repeatedCountry}>{entry.row.country}</Text>
                          </View>
                        </View>

                        <View style={styles.missingCodesGrid}>
                          {entry.items.map((code) => (
                            <View
                              key={code}
                              style={[
                                styles.missingCodeChip,
                                isTablet && styles.missingCodeChipTablet,
                                isGoldenSticker(code) && styles.missingCodeChipGolden,
                                isCocaSticker(code) && styles.missingCodeChipCoca,
                              ]}
                            >
                              <Text
                                style={[
                                  styles.missingCodeText,
                                  isTablet && styles.missingCodeTextTablet,
                                  isGoldenSticker(code) && styles.missingCodeTextGolden,
                                  isCocaSticker(code) && styles.missingCodeTextCoca,
                                ]}
                              >
                                {chipLabel(code)}
                              </Text>
                            </View>
                          ))}
                        </View>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            ) : (
              <View style={styles.repeatedBlock}>
                <Text style={styles.repeatedTitle}>Leitura e comparação de troca</Text>
                <Text style={styles.sectionHint}>Cole o conteúdo do QR (ALBUM|...) ou o link completo do QR.</Text>

                <View style={styles.qrActionRow}>
                  <Pressable style={styles.qrReadButton} onPress={onOpenScanner}>
                    <Text style={styles.qrReadButtonText}>Ler com câmera</Text>
                  </Pressable>
                  {isIosWeb ? (
                    <Pressable style={styles.qrReadButton} onPress={onOpenExternalCamera}>
                      <Text style={styles.qrReadButtonText}>Abrir câmera externa</Text>
                    </Pressable>
                  ) : null}
                  <Pressable style={styles.qrReadButton} onPress={onReadQrPayload}>
                    <Text style={styles.qrReadButtonText}>Ler texto colado</Text>
                  </Pressable>
                </View>

                {scannerOpen ? (
                  <View style={styles.scannerCard}>
                    {scannerError ? <Text style={styles.scannerError}>{scannerError}</Text> : null}
                    <CameraView
                      style={styles.scannerView}
                      active={scannerOpen}
                      facing="back"
                      onMountError={() => {
                        setScannerError('A câmera não conseguiu iniciar neste aparelho.');
                        setQrFeedback('A câmera não abriu. Use a opção de colar o QR.');
                      }}
                      onBarcodeScanned={scannerLocked ? undefined : onScanQr}
                      barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                    />
                    <Text style={styles.scannerHint}>
                      Enquadre o QR dentro da área da câmera.
                      {isIosWeb ? ' No iPhone, permita câmera para este site no Safari.' : ''}
                    </Text>
                    <Pressable style={styles.scannerCloseButton} onPress={() => setScannerOpen(false)}>
                      <Text style={styles.scannerCloseButtonText}>Fechar câmera</Text>
                    </Pressable>
                  </View>
                ) : null}

                <TextInput
                  value={qrInput}
                  onChangeText={setQrInput}
                  placeholder="Cole aqui o QR recebido"
                  placeholderTextColor="#64748b"
                  style={styles.qrInput}
                  multiline
                />

                {qrFeedback ? <Text style={styles.shareFeedback}>{qrFeedback}</Text> : null}

                {tradeComparison ? (
                  <View style={styles.tradeBlock}>
                    {!tradeComparison.isCompleteForExchange ? (
                      <Text style={styles.tradeWarn}>Use QR em modo Ambas para ver envio e recebimento completos.</Text>
                    ) : null}

                    <Text style={styles.tradeTitle}>A contraparte precisa</Text>
                    <Text style={styles.tradeCount}>{tradeComparison.counterpartyMissing.length}</Text>
                    {tradeComparison.groupedCounterpartyMissing.length > 0 ? (
                      <View style={styles.repeatedList}>
                        {tradeComparison.groupedCounterpartyMissing.map((entry) => (
                          <View key={`need-${entry.row.id}`} style={styles.repeatedGroupCard}>
                            <View style={styles.repeatedHeaderRow}>
                              <FlagIcon rowId={entry.row.id} fallback={flagForRow(entry.row)} />
                              <View>
                                <Text style={styles.repeatedCountry}>{entry.row.country}</Text>
                              </View>
                            </View>

                            <View style={styles.missingCodesGrid}>
                              {entry.items.map((code) => {
                                const canSend = (myRepeatedMap[code] ?? 0) > 0;

                                return (
                                  <View
                                    key={`need-${code}`}
                                    style={[
                                      styles.missingCodeChip,
                                      isTablet && styles.missingCodeChipTablet,
                                      canSend && styles.tradeCanSendChip,
                                    ]}
                                  >
                                    <Text
                                      style={[
                                        styles.missingCodeText,
                                        isTablet && styles.missingCodeTextTablet,
                                        canSend && styles.tradeCanSendText,
                                      ]}
                                    >
                                      {chipLabel(code)}
                                    </Text>
                                  </View>
                                );
                              })}
                            </View>
                          </View>
                        ))}
                      </View>
                    ) : (
                      <Text style={styles.tradeCodes}>Nenhuma figurinha listada pela contraparte</Text>
                    )}

                    <Text style={styles.tradeTitle}>Você pode enviar</Text>
                    <Text style={styles.tradeCount}>{tradeComparison.theyNeedFromMe.length}</Text>
                    {tradeComparison.groupedNeedFromMe.length > 0 ? (
                      <View style={styles.repeatedList}>
                        {tradeComparison.groupedNeedFromMe.map((entry) => (
                          <View key={`send-${entry.row.id}`} style={styles.repeatedGroupCard}>
                            <View style={styles.repeatedHeaderRow}>
                              <FlagIcon rowId={entry.row.id} fallback={flagForRow(entry.row)} />
                              <View>
                                <Text style={styles.repeatedCountry}>{entry.row.country}</Text>
                              </View>
                            </View>

                            <View style={styles.missingCodesGrid}>
                              {entry.items.map((code) => (
                                <View key={`send-${code}`} style={[styles.missingCodeChip, isTablet && styles.missingCodeChipTablet]}>
                                  <Text style={[styles.missingCodeText, isTablet && styles.missingCodeTextTablet]}>{chipLabel(code)}</Text>
                                </View>
                              ))}
                            </View>
                          </View>
                        ))}
                      </View>
                    ) : (
                      <Text style={styles.tradeCodes}>Nenhuma figurinha para enviar</Text>
                    )}

                    <Text style={styles.tradeTitle}>Você pode receber</Text>
                    <Text style={styles.tradeCount}>{tradeComparison.iNeedFromThem.length}</Text>
                    {tradeComparison.groupedNeedFromThem.length > 0 ? (
                      <View style={styles.repeatedList}>
                        {tradeComparison.groupedNeedFromThem.map((entry) => (
                          <View key={`receive-${entry.row.id}`} style={styles.repeatedGroupCard}>
                            <View style={styles.repeatedHeaderRow}>
                              <FlagIcon rowId={entry.row.id} fallback={flagForRow(entry.row)} />
                              <View>
                                <Text style={styles.repeatedCountry}>{entry.row.country}</Text>
                              </View>
                            </View>

                            <View style={styles.missingCodesGrid}>
                              {entry.items.map((code) => (
                                <View key={`receive-${code}`} style={[styles.missingCodeChip, isTablet && styles.missingCodeChipTablet]}>
                                  <Text style={[styles.missingCodeText, isTablet && styles.missingCodeTextTablet]}>{chipLabel(code)}</Text>
                                </View>
                              ))}
                            </View>
                          </View>
                        ))}
                      </View>
                    ) : (
                      <Text style={styles.tradeCodes}>Nenhuma figurinha para receber</Text>
                    )}

                  </View>
                ) : null}
              </View>
            )}
          </View>
        </ScrollView>
      )}

      </View>

      <StatusBar style="light" />
    </SafeAreaView>
  );
}

function StatCard({ label, value, isTablet }: { label: string; value: string; isTablet?: boolean }) {
  return (
    <View style={[styles.statCard, isTablet && styles.statCardTablet]}>
      <Text style={[styles.statLabel, isTablet && styles.statLabelTablet]}>{label}</Text>
      <Text style={[styles.statValue, isTablet && styles.statValueTablet]}>{value}</Text>
    </View>
  );
}

function FlagIcon({ rowId, fallback }: { rowId: string; fallback: string }) {
  const uri = countryFlagUriById[rowId];

  if (!uri) {
    return <Text style={styles.flagFallback}>{fallback}</Text>;
  }

  return <Image source={{ uri }} style={styles.flagImage} />;
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#08111f',
    overflow: 'hidden',
  },
  glowTop: {
    position: 'absolute',
    top: -90,
    right: -40,
    width: 220,
    height: 220,
    borderRadius: 999,
    backgroundColor: '#1d4ed8',
    opacity: 0.28,
  },
  glowBottom: {
    position: 'absolute',
    bottom: -120,
    left: -70,
    width: 280,
    height: 280,
    borderRadius: 999,
    backgroundColor: '#f97316',
    opacity: 0.15,
  },
  content: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 120,
  },
  contentTablet: {
    paddingHorizontal: 22,
    paddingBottom: 140,
  },
  appFrame: {
    flex: 1,
    width: '100%',
  },
  appFrameTablet: {
    alignSelf: 'center',
    maxWidth: 980,
  },
  authWrap: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  authCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1f2a3d',
    backgroundColor: '#0b1326',
    padding: 14,
    gap: 8,
  },
  authTitle: {
    color: '#e2e8f0',
    fontSize: 18,
    fontWeight: '800',
  },
  authSubtitle: {
    color: '#94a3b8',
    fontSize: 12,
  },
  sessionBar: {
    marginHorizontal: 14,
    marginTop: 10,
    marginBottom: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1f2a3d',
    backgroundColor: '#0b1326',
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  sessionEmail: {
    color: '#93c5fd',
    fontSize: 12,
    fontWeight: '700',
    flex: 1,
  },
  sessionSignOutButton: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#475569',
    backgroundColor: '#1e293b',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  sessionSignOutText: {
    color: '#e2e8f0',
    fontSize: 11,
    fontWeight: '800',
  },
  cloudCard: {
    marginHorizontal: 14,
    marginTop: 10,
    marginBottom: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1f2a3d',
    backgroundColor: '#0b1326',
    padding: 12,
    gap: 8,
  },
  cloudTitle: {
    color: '#e2e8f0',
    fontSize: 14,
    fontWeight: '800',
  },
  cloudSubtitle: {
    color: '#93c5fd',
    fontSize: 12,
    fontWeight: '700',
  },
  cloudInput: {
    backgroundColor: '#0f172a',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
    color: '#fff',
    fontSize: 13,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  cloudButtonPrimary: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#60a5fa',
    backgroundColor: '#1d4ed8',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  cloudButtonPrimaryText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
  },
  cloudButtonRow: {
    flexDirection: 'row',
    gap: 8,
  },
  cloudButtonHalf: {
    flex: 1,
  },
  cloudButtonDisabled: {
    opacity: 0.6,
  },
  cloudButtonSecondary: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#475569',
    backgroundColor: '#1e293b',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  cloudButtonSecondaryText: {
    color: '#e2e8f0',
    fontSize: 12,
    fontWeight: '800',
  },
  cloudHint: {
    color: '#94a3b8',
    fontSize: 12,
  },
  cloudStatus: {
    color: '#93c5fd',
    fontSize: 12,
    fontWeight: '700',
  },
  tabRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 4,
  },
  tabRowTablet: {
    paddingHorizontal: 22,
  },
  tabButton: {
    minWidth: 110,
    flexGrow: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1f2937',
    backgroundColor: '#0f172a',
    alignItems: 'center',
  },
  tabButtonTablet: {
    minWidth: 140,
  },
  tabButtonActive: {
    backgroundColor: '#1d4ed8',
    borderColor: '#60a5fa',
  },
  tabButtonText: {
    color: '#cbd5e1',
    fontSize: 13,
    fontWeight: '700',
  },
  tabButtonTextActive: {
    color: '#fff',
  },
  hero: {
    backgroundColor: '#0f172a',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#1e293b',
    padding: 18,
    marginBottom: 14,
  },
  kicker: {
    color: '#93c5fd',
    letterSpacing: 2,
    fontSize: 11,
    fontWeight: '800',
  },
  title: {
    color: '#fff',
    fontSize: 30,
    lineHeight: 34,
    fontWeight: '800',
    marginTop: 6,
  },
  titleTablet: {
    fontSize: 34,
    lineHeight: 38,
  },
  subtitle: {
    color: '#cbd5e1',
    fontSize: 14,
    lineHeight: 21,
    marginTop: 8,
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 14,
  },
  statCard: {
    flexGrow: 1,
    minWidth: '48%',
    backgroundColor: '#0b1326',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#1f2a3d',
  },
  statCardTablet: {
    padding: 14,
  },
  statLabel: {
    color: '#94a3b8',
    fontSize: 11,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  statLabelTablet: {
    fontSize: 12,
  },
  statValue: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '800',
  },
  statValueTablet: {
    fontSize: 24,
  },
  progressBlock: {
    marginTop: 14,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  progressLabel: {
    color: '#e2e8f0',
    fontSize: 13,
    fontWeight: '700',
  },
  progressValue: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
  },
  progressTrack: {
    height: 10,
    backgroundColor: '#1e293b',
    borderRadius: 999,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#22c55e',
  },
  statsActionRow: {
    marginTop: 12,
    flexDirection: 'row',
  },
  clearAllButton: {
    minWidth: 150,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#f87171',
    backgroundColor: '#3f1d1d',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  clearAllButtonText: {
    color: '#fee2e2',
    fontSize: 12,
    fontWeight: '800',
  },
  shareBlock: {
    marginTop: 16,
    backgroundColor: '#0b1326',
    borderWidth: 1,
    borderColor: '#1f2a3d',
    borderRadius: 16,
    padding: 12,
    gap: 12,
  },
  shareTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
  },
  shareScopeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  shareScopeChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#111827',
  },
  shareScopeChipActive: {
    borderColor: '#60a5fa',
    backgroundColor: '#1d4ed8',
  },
  shareScopeText: {
    color: '#cbd5e1',
    fontSize: 12,
    fontWeight: '700',
  },
  shareScopeTextActive: {
    color: '#fff',
  },
  qrContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 180,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1f2a3d',
    backgroundColor: '#0f172a',
    padding: 10,
  },
  qrImage: {
    width: 180,
    height: 180,
    borderRadius: 8,
    backgroundColor: '#fff',
  },
  qrLocalFrame: {
    width: 196,
    height: 196,
    borderRadius: 10,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
  },
  shareActionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  shareActionButton: {
    minWidth: 130,
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#1d4ed8',
    borderWidth: 1,
    borderColor: '#60a5fa',
  },
  shareActionDisabled: {
    backgroundColor: '#334155',
    borderColor: '#475569',
  },
  shareActionText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
  },
  shareFeedback: {
    color: '#93c5fd',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'justify',
  },
  scopePickerBlock: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#0f172a',
    padding: 10,
    gap: 8,
  },
  scopePickerTitle: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
  },
  scopePickerSubtitle: {
    color: '#cbd5e1',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  scopePickerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  scopePickerButton: {
    minWidth: 120,
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#60a5fa',
    backgroundColor: '#1d4ed8',
    paddingVertical: 8,
  },
  scopePickerButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
  },
  scopePickerCopyButton: {
    minWidth: 120,
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#16a34a',
    backgroundColor: '#166534',
    paddingVertical: 8,
  },
  scopePickerCancel: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  scopePickerCancelText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '700',
  },
  qrInput: {
    marginTop: 10,
    minHeight: 120,
    backgroundColor: '#0f172a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    color: '#fff',
    fontSize: 13,
    paddingHorizontal: 12,
    paddingVertical: 10,
    textAlignVertical: 'top',
  },
  qrActionRow: {
    marginTop: 10,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  qrReadButton: {
    minWidth: 150,
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: '#2563eb',
    borderWidth: 1,
    borderColor: '#60a5fa',
    paddingVertical: 10,
  },
  qrReadButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
  },
  scannerCard: {
    marginTop: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#0f172a',
    padding: 10,
    gap: 10,
  },
  scannerView: {
    width: '100%',
    height: 240,
    backgroundColor: '#000',
  },
  scannerHint: {
    color: '#cbd5e1',
    fontSize: 12,
    textAlign: 'center',
    fontWeight: '700',
  },
  scannerError: {
    color: '#fecaca',
    fontSize: 12,
    textAlign: 'center',
    fontWeight: '700',
  },
  scannerCloseButton: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#475569',
    backgroundColor: '#1e293b',
    paddingVertical: 8,
  },
  scannerCloseButtonText: {
    color: '#e2e8f0',
    fontSize: 12,
    fontWeight: '800',
  },
  tradeBlock: {
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#0b1326',
    gap: 6,
  },
  tradeTitle: {
    color: '#e2e8f0',
    fontSize: 13,
    fontWeight: '800',
  },
  tradeCount: {
    color: '#22c55e',
    fontSize: 18,
    fontWeight: '900',
  },
  tradeCodes: {
    color: '#cbd5e1',
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 6,
    textAlign: 'justify',
  },
  tradeWarn: {
    color: '#fbbf24',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'justify',
  },
  tradeCanSendChip: {
    backgroundColor: '#12311f',
    borderColor: '#22c55e',
  },
  tradeCanSendText: {
    color: '#bbf7d0',
  },
  tradePairsList: {
    marginTop: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#111827',
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 4,
  },
  tradePairItem: {
    color: '#e2e8f0',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'justify',
  },
  repeatedBlock: {
    marginTop: 14,
  },
  repeatedTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 10,
  },
  repeatedActionRow: {
    marginTop: 12,
    flexDirection: 'row',
  },
  repeatedClearButton: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#f87171',
    backgroundColor: '#3f1d1d',
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  repeatedClearButtonDisabled: {
    borderColor: '#475569',
    backgroundColor: '#1e293b',
    opacity: 0.7,
  },
  repeatedClearButtonText: {
    color: '#fee2e2',
    fontSize: 12,
    fontWeight: '800',
  },
  repeatedList: {
    gap: 8,
  },
  repeatedGroupCard: {
    backgroundColor: '#0b1326',
    borderWidth: 1,
    borderColor: '#1f2a3d',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  repeatedHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  repeatedCountry: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
  },
  repeatedCodesWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  repeatedItem: {
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  repeatedCode: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  repeatedQty: {
    color: '#fbbf24',
    fontSize: 13,
    fontWeight: '800',
  },
  missingCodesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: 6,
    rowGap: 6,
  },
  missingCodeChip: {
    minWidth: 56,
    alignItems: 'center',
    borderRadius: 8,
    paddingHorizontal: 2,
    paddingVertical: 6,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#334155',
  },
  missingCodeChipTablet: {
    minWidth: 68,
    paddingVertical: 7,
  },
  missingCodeChipGolden: {
    backgroundColor: '#3a2f10',
    borderColor: '#d4a53a',
  },
  missingCodeChipCoca: {
    backgroundColor: '#3a0f14',
    borderColor: '#dc2626',
  },
  missingCodeText: {
    color: '#dbe4f0',
    fontSize: 10,
    fontWeight: '800',
  },
  missingCodeTextGolden: {
    color: '#fde68a',
  },
  missingCodeTextCoca: {
    color: '#fecaca',
  },
  missingCodeTextTablet: {
    fontSize: 11,
  },
  toolbar: {
    gap: 12,
    marginBottom: 10,
  },
  search: {
    backgroundColor: '#0f172a',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1e293b',
    color: '#fff',
    fontSize: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  filterRow: {
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  filterChipActive: {
    backgroundColor: '#1d4ed8',
    borderColor: '#60a5fa',
  },
  filterText: {
    color: '#cbd5e1',
    fontSize: 12,
    fontWeight: '700',
  },
  filterTextActive: {
    color: '#fff',
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '800',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginTop: 8,
    marginBottom: 8,
  },
  sectionHint: {
    color: '#94a3b8',
    fontSize: 12,
    textAlign: 'justify',
  },
  rowCard: {
    backgroundColor: '#0f172a',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#1e293b',
    padding: 14,
  },
  rowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  rowTitleBlock: {
    flex: 1,
  },
  country: {
    color: '#fff',
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '800',
  },
  countryTablet: {
    fontSize: 20,
    lineHeight: 24,
  },
  completedMark: {
    color: '#22c55e',
    fontSize: 16,
    fontWeight: '900',
  },
  countryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  flagImage: {
    width: 22,
    height: 16,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: '#334155',
  },
  flagFallback: {
    fontSize: 16,
  },
  prefix: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 4,
  },
  rowMeta: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  rowMetaValue: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '900',
  },
  rowMetaLabel: {
    color: '#94a3b8',
    fontSize: 11,
    textTransform: 'uppercase',
    marginTop: 2,
  },
  rowProgressTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: '#1e293b',
    overflow: 'hidden',
    marginTop: 12,
    marginBottom: 12,
  },
  rowProgressFill: {
    height: '100%',
    borderRadius: 999,
  },
  codeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: 6,
    rowGap: 6,
  },
  codeChip: {
    minWidth: 56,
    alignItems: 'center',
    borderRadius: 8,
    paddingHorizontal: 2,
    paddingVertical: 6,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#243244',
  },
  codeChipTablet: {
    minWidth: 68,
    paddingVertical: 7,
  },
  codeChipCollected: {
    backgroundColor: '#12311f',
    borderColor: '#22c55e',
  },
  codeChipGolden: {
    backgroundColor: '#3a2f10',
    borderColor: '#d4a53a',
  },
  codeChipCoca: {
    backgroundColor: '#3a0f14',
    borderColor: '#dc2626',
  },
  codeChipText: {
    color: '#dbe4f0',
    fontSize: 10,
    fontWeight: '800',
  },
  codeChipTextTablet: {
    fontSize: 11,
  },
  codeChipTextCollected: {
    color: '#bbf7d0',
  },
  codeChipTextGolden: {
    color: '#fde68a',
  },
  codeChipTextCoca: {
    color: '#fecaca',
  },
  expandText: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 10,
    fontWeight: '600',
  },
  separator: {
    height: 10,
  },
  empty: {
    color: '#cbd5e1',
    textAlign: 'center',
    marginTop: 24,
    fontSize: 14,
  },
});
