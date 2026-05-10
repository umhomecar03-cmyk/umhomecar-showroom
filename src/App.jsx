import React, { useEffect, useMemo, useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import {
  Camera,
  CheckCircle2,
  ChevronLeft,
  Clipboard,
  Copy,
  Download,
  Eye,
  Gauge,
  Grid2X2,
  ImagePlus,
  LogOut,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Search,
  Share2,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  UploadCloud,
  X,
} from 'lucide-react';
import { cars as sampleCars } from './data/cars.js';
import { SITE_CONFIG } from './config/site.js';
import { hasSupabaseConfig, supabase } from './lib/supabase.js';
import { mapCarToDb, mapDbCar } from './lib/carMapper.js';

const STATUS_LABEL = {
  available: 'พร้อมขาย',
  reserved: 'จองแล้ว',
  sold: 'ขายแล้ว',
  hidden: 'ซ่อน',
};

const STATUS_CLASS = {
  available: 'statusAvailable',
  reserved: 'statusReserved',
  sold: 'statusSold',
  hidden: 'statusHidden',
};

const EMPTY_FORM = {
  dbId: '',
  carCode: '',
  title: '',
  brand: '',
  model: '',
  year: '',
  price: '',
  monthlyStartText: '',
  mileageText: '',
  engineText: '',
  transmissionText: '',
  plate: '',
  promotion: 'ฟรีดาวน์ ฟรีจัด ฟรีโอน',
  guaranteeText: 'ไม่มีชนหนัก ไม่น้ำท่วม 100%',
  installments: [
    { years: 4, amountText: '' },
    { years: 5, amountText: '' },
    { years: 6, amountText: '' },
    { years: 7, amountText: '' },
  ],
  featuresText: '',
  images: [],
  status: 'available',
  sortOrder: 0,
};

const formatPrice = (price) => new Intl.NumberFormat('th-TH').format(price || 0);

function getCarFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get('car');
}

function updateCarUrl(carId) {
  const url = new URL(window.location.href);
  if (carId) url.searchParams.set('car', carId);
  else url.searchParams.delete('car');
  window.history.pushState({}, '', url);
}

function normalize(text = '') {
  return String(text).toLowerCase().replace(/\s+/g, ' ').trim();
}

function getMainImage(car) {
  return car?.images?.[0] || '/images/car-placeholder.svg';
}

async function canvasToBlob(canvas) {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png', 1));
}

function sanitizeFileName(text = '') {
  return text
    .toString()
    .trim()
    .replace(/[^a-zA-Z0-9ก-ฮะ-์._-]+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 90);
}


function stripDecorations(text = '') {
  return String(text)
    .replace(/[🎈🎯🎉⭐️⏰🔥✅📌🚗💰]/g, '')
    .replace(/[•●▪︎►]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseNumberText(text = '') {
  const cleaned = String(text).replace(/[^0-9]/g, '');
  return cleaned ? Number(cleaned) : 0;
}

function normalizeAmountText(text = '') {
  return String(text)
    .replace(/บาท|เดือน|\/|:|：/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function makeCarCodeFromParsed(parsed) {
  const brand = sanitizeFileName(parsed.brand || 'CAR').toUpperCase() || 'CAR';
  const year = parsed.year || new Date().getFullYear();
  const plate = sanitizeFileName(parsed.plate || '').toUpperCase().replace(/-/g, '') || String(Date.now()).slice(-5);
  return `UM-${brand}-${year}-${plate}`.replace(/-+/g, '-');
}

function parseCarText(rawText = '') {
  const text = String(rawText || '').replace(/\r/g, '').trim();
  const lines = text
    .split('\n')
    .map((line) => stripDecorations(line))
    .map((line) => line.replace(/^[-–—]+\s*/, '').trim())
    .filter(Boolean);

  const skippedPhrases = [
    'รถสวยมากคันนี้',
    'ตารางผ่อนแบบฟรีดาวน์',
    'ระยะการผ่อน',
  ];

  const titleLine = lines.find((line) => {
    const lower = line.toLowerCase();
    return !skippedPhrases.some((phrase) => lower.includes(phrase.toLowerCase())) &&
      !/^(ราคา|เพียง|ผ่อน|ไมล์|เครื่อง|เกียร์|ทะเบียน|ฟรีดาวน์|\d+\s*ปี)/i.test(line);
  }) || '';

  const yearMatch = titleLine.match(/ปี\s*(19\d{2}|20\d{2}|25\d{2})/) || text.match(/ปี\s*(19\d{2}|20\d{2}|25\d{2})/);
  const year = yearMatch ? yearMatch[1] : '';

  const title = stripDecorations(titleLine).replace(/\s+/g, ' ').trim();
  const titleParts = title.split(/\s+/).filter(Boolean);
  const brand = titleParts[0] || '';
  const model = titleParts.slice(1, 3).join(' ');

  const priceMatch = text.match(/(?:ราคา|เพียง)\s*([^\n]*?)([0-9][0-9,\.xX]*)\s*บาท/i);
  const price = priceMatch ? parseNumberText(priceMatch[2]) : 0;

  const monthlyMatch = text.match(/ผ่อนเริ่มต้น\s*([^\n]*?)([0-9][0-9,\.xX]*)/i);
  let monthlyStartText = monthlyMatch ? normalizeAmountText(monthlyMatch[2]) : '';

  const installmentRows = [];
  const installmentRegex = /(^|\n)\s*(\d+)\s*ปี\s*([0-9][0-9,\.xX]*)/gi;
  let rowMatch;
  while ((rowMatch = installmentRegex.exec(text))) {
    installmentRows.push({ years: Number(rowMatch[2]), amountText: normalizeAmountText(rowMatch[3]) });
  }
  if (!monthlyStartText && installmentRows.length) {
    monthlyStartText = installmentRows[installmentRows.length - 1].amountText;
  }

  const mileageMatch = text.match(/ไมล์\s*([0-9][0-9,\.xX]*)\s*(km|กม\.?|กิโลเมตร)?/i);
  const mileageText = mileageMatch ? `${normalizeAmountText(mileageMatch[1])} Km` : '';

  const engineMatch = text.match(/(?:เครื่องยนต์|เครื่อง)\s*([0-9][0-9,\.]*)\s*cc/i);
  const engineText = engineMatch ? `${engineMatch[1].replace(/\s+/g, '')}cc` : '';

  const transmissionLine = lines.find((line) => /^เกียร์/i.test(line));
  const transmissionText = transmissionLine ? transmissionLine.replace(/^เกียร์\s*/i, 'เกียร์').trim() : '';

  const plateMatch = text.match(/ทะเบียน(?:รถ)?\s*[:：]?\s*([^\n]+)/i);
  const plate = plateMatch ? stripDecorations(plateMatch[1]) : '';

  const promotionLine = lines.find((line) => /ฟรีดาวน์|ฟรีจัด|ฟรีโอน/i.test(line));
  const promotion = promotionLine ? stripDecorations(promotionLine) : 'ฟรีดาวน์ ฟรีจัด ฟรีโอน';

  const guaranteeCandidates = lines.filter((line) => /ไม่มีชนหนัก|ไม่น้ำท่วม|กล้าท้า|ช่างศูนย์/i.test(line));
  const guaranteeText = guaranteeCandidates.length
    ? guaranteeCandidates.join(' ').replace(/รถสวยมากคันนี้/g, '').replace(/\s+/g, ' ').trim()
    : 'ไม่มีชนหนัก ไม่น้ำท่วม 100%';

  const featureLines = lines.filter((line) => {
    if (!line) return false;
    if (line === title) return false;
    if (/รถสวยมากคันนี้/i.test(line)) return false;
    if (/ไม่มีชนหนัก|ไม่น้ำท่วม|กล้าท้า|ช่างศูนย์/i.test(line)) return false;
    if (/^(ราคา|เพียง|ผ่อนเริ่มต้น|ไมล์|เครื่องยนต์|เครื่อง|เกียร์|ทะเบียน|ตารางผ่อน|ระยะการผ่อน)/i.test(line)) return false;
    if (/^\d+\s*ปี\s*/i.test(line)) return false;
    if (/ฟรีดาวน์|ฟรีจัด|ฟรีโอน/i.test(line)) return false;
    return true;
  });

  const parsed = {
    carCode: '',
    title,
    brand,
    model,
    year,
    price,
    monthlyStartText,
    mileageText,
    engineText,
    transmissionText,
    plate,
    promotion,
    guaranteeText,
    installments: [4, 5, 6, 7].map((years) => {
      const found = installmentRows.find((row) => row.years === years);
      return { years, amountText: found?.amountText || '' };
    }),
    featuresText: featureLines.join('\n'),
  };

  parsed.carCode = makeCarCodeFromParsed(parsed);
  return parsed;
}

function dbCarToForm(car) {
  return {
    ...EMPTY_FORM,
    dbId: car.dbId || '',
    carCode: car.carCode || car.id || '',
    title: car.title || '',
    brand: car.brand || '',
    model: car.model || '',
    year: car.year || '',
    price: car.price || '',
    monthlyStartText: car.monthlyStartText || '',
    mileageText: car.mileageText || '',
    engineText: car.engineText || '',
    transmissionText: car.transmissionText || '',
    plate: car.plate || '',
    promotion: car.promotion || '',
    guaranteeText: car.guaranteeText || '',
    installments: car.installments?.length ? car.installments : EMPTY_FORM.installments,
    featuresText: car.features?.join('\n') || '',
    images: car.images || [],
    status: car.status || 'available',
    sortOrder: car.sortOrder || 0,
  };
}

function formToCar(form) {
  return {
    ...form,
    id: form.carCode,
    year: Number(form.year || 0) || '',
    price: Number(form.price || 0),
    sortOrder: Number(form.sortOrder || 0),
    installments: form.installments.map((row) => ({
      years: Number(row.years),
      amountText: row.amountText || '',
    })),
    features: form.featuresText
      .split('\n')
      .map((item) => item.trim())
      .filter(Boolean),
  };
}

async function fetchCars({ includeHidden = false } = {}) {
  if (!hasSupabaseConfig || !supabase) return sampleCars;

  let query = supabase
    .from('cars')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false });

  if (!includeHidden) query = query.neq('status', 'hidden');

  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map(mapDbCar);
}

export default function App() {
  const isAdminRoute = window.location.pathname.startsWith('/admin');
  return isAdminRoute ? <AdminApp /> : <ShowroomApp />;
}

function ShowroomApp() {
  const [cars, setCars] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('available');
  const [priceRange, setPriceRange] = useState('all');
  const [selectedCar, setSelectedCar] = useState(null);
  const [toast, setToast] = useState('');
  const [brand, setBrand] = useState('all');

  async function loadCars() {
    setIsLoading(true);
    setLoadError('');
    try {
      const rows = await fetchCars({ includeHidden: false });
      setCars(rows);
    } catch (error) {
      console.error(error);
      setLoadError('โหลดข้อมูลจาก Supabase ไม่สำเร็จ ตอนนี้แสดงข้อมูลตัวอย่างแทนครับ');
      setCars(sampleCars);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadCars();
  }, []);

  useEffect(() => {
    const carId = getCarFromUrl();
    if (carId && cars.length) {
      const found = cars.find((item) => item.id === carId || item.carCode === carId);
      if (found) setSelectedCar(found);
    }

    const onPop = () => {
      const nextId = getCarFromUrl();
      setSelectedCar(cars.find((item) => item.id === nextId || item.carCode === nextId) || null);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [cars]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(''), 2400);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const brands = useMemo(() => ['all', ...Array.from(new Set(cars.map((car) => car.brand).filter(Boolean)))], [cars]);

  const filteredCars = useMemo(() => {
    const q = normalize(query);
    return cars.filter((car) => {
      const text = normalize(`${car.title} ${car.brand} ${car.model} ${car.year} ${car.plate} ${car.id}`);
      const matchQuery = !q || text.includes(q);
      const matchBrand = brand === 'all' || car.brand === brand;
      const matchStatus = status === 'all' || car.status === status;
      const price = Number(car.price || 0);
      const matchPrice =
        priceRange === 'all' ||
        (priceRange === 'lt500' && price < 500000) ||
        (priceRange === '500to800' && price >= 500000 && price <= 800000) ||
        (priceRange === 'gt800' && price > 800000);
      return matchQuery && matchBrand && matchStatus && matchPrice;
    });
  }, [cars, query, brand, status, priceRange]);

  const stats = useMemo(() => {
    const available = cars.filter((car) => car.status === 'available').length;
    const reserved = cars.filter((car) => car.status === 'reserved').length;
    const sold = cars.filter((car) => car.status === 'sold').length;
    return { all: cars.length, available, reserved, sold };
  }, [cars]);

  function openCar(car) {
    setSelectedCar(car);
    updateCarUrl(car.id);
  }

  function closeCar() {
    setSelectedCar(null);
    updateCarUrl(null);
  }

  return (
    <main className="appShell">
      <Hero stats={stats} />

      <section className="contentWrap">
        {loadError && <div className="warningBox">{loadError}</div>}
        {!hasSupabaseConfig && (
          <div className="warningBox">
            ยังไม่ได้ตั้งค่า Supabase Environment Variables ตอนนี้เว็บจะแสดงข้อมูลตัวอย่างจากไฟล์ cars.js
          </div>
        )}

        <Toolbar
          query={query}
          setQuery={setQuery}
          brand={brand}
          setBrand={setBrand}
          brands={brands}
          status={status}
          setStatus={setStatus}
          priceRange={priceRange}
          setPriceRange={setPriceRange}
          resultCount={filteredCars.length}
        />

        {isLoading ? (
          <div className="emptyState">
            <RefreshCw size={34} className="spinIcon" />
            <h3>กำลังโหลดข้อมูลรถ</h3>
            <p>รอสักครู่ครับ</p>
          </div>
        ) : (
          <div className="carGrid" aria-live="polite">
            {filteredCars.map((car, index) => (
              <CarCard key={car.dbId || car.id} car={car} priority={index === 0} onOpen={() => openCar(car)} />
            ))}
          </div>
        )}

        {!isLoading && filteredCars.length === 0 && (
          <div className="emptyState">
            <Search size={34} />
            <h3>ไม่พบรถตามเงื่อนไขที่ค้นหา</h3>
            <p>ลองลบคำค้นหา หรือเลือกสถานะ/ช่วงราคาใหม่อีกครั้งครับ</p>
          </div>
        )}
      </section>

      {selectedCar && <CarDetail car={selectedCar} onClose={closeCar} setToast={setToast} />}
      {toast && <div className="toast">{toast}</div>}
    </main>
  );
}

function Hero({ stats }) {
  return (
    <header className="hero">
      <div className="heroGlow" />
      <nav className="topNav">
        <div className="brandMark" aria-label={SITE_CONFIG.shopName}>
          <span>{SITE_CONFIG.logoText}</span>
        </div>
        <div className="livePill">
          <span className="pulseDot" />
          <span>{SITE_CONFIG.liveViewerText}</span>
        </div>
      </nav>

      <div className="heroContent">
        <div className="eyebrow">
          <Sparkles size={16} /> รถพร้อมขาย อัปเดตล่าสุด
        </div>
        <h1>{SITE_CONFIG.headline}</h1>
        <p>{SITE_CONFIG.subHeadline}</p>

        <div className="statRow">
          <div className="statCard">
            <strong>{stats.available}</strong>
            <span>พร้อมขาย</span>
          </div>
          <div className="statCard">
            <strong>{stats.reserved}</strong>
            <span>จองแล้ว</span>
          </div>
          <div className="statCard">
            <strong>{stats.all}</strong>
            <span>ทั้งหมด</span>
          </div>
        </div>
      </div>
    </header>
  );
}

function Toolbar({
  query,
  setQuery,
  brand,
  setBrand,
  brands,
  status,
  setStatus,
  priceRange,
  setPriceRange,
  resultCount,
}) {
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Mobile filters are rendered inline, so we do not lock the page scroll here.

  return (
    <section className="toolbarCard">
      <div className="searchBox">
        <Search size={18} />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="ค้นหารุ่นรถ / ยี่ห้อ / ปี / ทะเบียน"
          inputMode="search"
          enterKeyHint="search"
          autoComplete="off"
          spellCheck="false"
        />
      </div>

      <button type="button" className="mobileFilterButton" onClick={() => setFiltersOpen(true)}>
        <SlidersHorizontal size={17} /> ตัวกรอง <span>{resultCount} คัน</span>
      </button>

      <div className="filterHeader" aria-hidden="true">
        <div>
          <SlidersHorizontal size={17} /> ตัวกรอง
        </div>
        <span>{resultCount} คัน</span>
      </div>

      {filtersOpen && <button type="button" className="filterSheetBackdrop" aria-label="ปิดตัวกรอง" onClick={() => setFiltersOpen(false)} />}

      <div className={`filterGrid ${filtersOpen ? 'mobileSheetOpen' : ''}`}>
        <div className="filterSheetTop">
          <strong>ตัวกรองรถ</strong>
          <button type="button" className="iconButton compactIconButton" onClick={() => setFiltersOpen(false)} aria-label="ปิดตัวกรอง">
            <X size={18} />
          </button>
        </div>

        <label>
          ยี่ห้อ
          <select value={brand} onChange={(event) => setBrand(event.target.value)}>
            {brands.map((item) => (
              <option key={item} value={item}>
                {item === 'all' ? 'ทุกยี่ห้อ' : item}
              </option>
            ))}
          </select>
        </label>

        <label>
          สถานะ
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="available">พร้อมขาย</option>
            <option value="reserved">จองแล้ว</option>
            <option value="sold">ขายแล้ว</option>
            <option value="all">ทั้งหมด</option>
          </select>
        </label>

        <label>
          ราคา
          <select value={priceRange} onChange={(event) => setPriceRange(event.target.value)}>
            <option value="all">ทุกราคา</option>
            <option value="lt500">ต่ำกว่า 500,000</option>
            <option value="500to800">500,000 - 800,000</option>
            <option value="gt800">มากกว่า 800,000</option>
          </select>
        </label>

        <button type="button" className="applyFilterButton" onClick={() => setFiltersOpen(false)}>
          ใช้ตัวกรอง
        </button>
      </div>
    </section>
  );
}

function CarCard({ car, onOpen, priority = false }) {
  return (
    <article className="carCard" onClick={onOpen} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && onOpen()}>
      <div className="carImageWrap">
        <img
          src={getMainImage(car)}
          alt={car.title}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          fetchPriority={priority ? 'high' : 'auto'}
        />
        <div className={`statusBadge ${STATUS_CLASS[car.status]}`}>{STATUS_LABEL[car.status] || car.status}</div>
      </div>

      <div className="carCardBody">
        <div className="idLine">รหัสรถ {car.id}</div>
        <h2>{car.title}</h2>
        <div className="priceLine">{formatPrice(car.price)} บาท</div>
        <div className="monthlyLine">ผ่อนเริ่มต้น {car.monthlyStartText} บาท / เดือน</div>

        <div className="quickSpecGrid">
          <span><Gauge size={15} /> {car.mileageText}</span>
          <span>{car.engineText}</span>
          <span>{car.transmissionText}</span>
          <span>ทะเบียน {car.plate}</span>
        </div>

        <button className="primaryButton" type="button">
          ดูรายละเอียด
        </button>
      </div>
    </article>
  );
}

function CarDetail({ car, onClose, setToast }) {
  const [activeImage, setActiveImage] = useState(0);
  const [isCapturing, setIsCapturing] = useState(false);
  const shareCardRef = useRef(null);

  useEffect(() => {
    document.body.classList.add('modalOpen');
    return () => document.body.classList.remove('modalOpen');
  }, []);

  const carUrl = useMemo(() => {
    const url = new URL(window.location.href);
    url.searchParams.set('car', car.id);
    return url.toString();
  }, [car.id]);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(carUrl);
      setToast('คัดลอกลิงก์รถเรียบร้อยครับ');
    } catch (error) {
      setToast('คัดลอกไม่ได้ กรุณาคัดลอกจากแถบลิงก์ด้านบนครับ');
    }
  }

  async function captureShareCard() {
    if (!shareCardRef.current) return;
    setIsCapturing(true);
    try {
      const canvas = await html2canvas(shareCardRef.current, {
        backgroundColor: '#ffffff',
        scale: Math.min(window.devicePixelRatio || 2, 3),
        useCORS: true,
        allowTaint: false,
        logging: false,
      });
      const blob = await canvasToBlob(canvas);
      const fileName = `${car.id}.png`;
      const file = new File([blob], fileName, { type: 'image/png' });

      if (navigator.canShare?.({ files: [file] }) && navigator.share) {
        await navigator.share({
          files: [file],
          title: car.title,
          text: `ข้อมูลรถ ${car.title}`,
        });
        setToast('เปิดเมนูแชร์รูปแล้วครับ');
      } else {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
        setToast('บันทึกรูปข้อมูลรถแล้วครับ');
      }
    } catch (error) {
      console.error(error);
      setToast('สร้างรูปไม่สำเร็จ กรุณาตรวจสอบรูปภาพรถหรือ CORS ครับ');
    } finally {
      setIsCapturing(false);
    }
  }

  return (
    <section className="detailOverlay" aria-modal="true" role="dialog">
      <div className="detailPage">
        <div className="detailTopBar">
          <button type="button" className="iconButton" onClick={onClose} aria-label="กลับ">
            <ChevronLeft size={22} />
          </button>
          <strong>รายละเอียดรถ</strong>
          <button type="button" className="iconButton" onClick={onClose} aria-label="ปิด">
            <X size={21} />
          </button>
        </div>

        <div className="detailHeroImage">
          <img src={car.images?.[activeImage] || getMainImage(car)} alt={car.title} loading="eager" decoding="async" fetchPriority="high" />
          <div className={`statusBadge detailBadge ${STATUS_CLASS[car.status]}`}>{STATUS_LABEL[car.status]}</div>
        </div>

        {car.images?.length > 1 && (
          <div className="thumbRow">
            {car.images.map((img, index) => (
              <button key={img} type="button" className={activeImage === index ? 'activeThumb' : ''} onClick={() => setActiveImage(index)}>
                <img src={img} alt={`${car.title} รูปที่ ${index + 1}`} loading="lazy" decoding="async" />
              </button>
            ))}
          </div>
        )}

        <div className="detailContent">
          <div className="detailId">รหัสรถ {car.id}</div>
          <h2>{car.title}</h2>

          <div className="bigPriceCard">
            <span>ราคา</span>
            <strong>{formatPrice(car.price)} บาท</strong>
            <em>ผ่อนเริ่มต้น {car.monthlyStartText} บาท / เดือน</em>
          </div>

          <section className="infoPanel">
            <h3><Grid2X2 size={18} /> รายละเอียดรถ</h3>
            <div className="specList">
              <div><span>ไมล์</span><strong>{car.mileageText}</strong></div>
              <div><span>เครื่องยนต์</span><strong>{car.engineText}</strong></div>
              <div><span>เกียร์</span><strong>{car.transmissionText}</strong></div>
              <div><span>ทะเบียนรถ</span><strong>{car.plate}</strong></div>
            </div>
          </section>

          <section className="infoPanel">
            <h3><ShieldCheck size={18} /> จุดเด่น</h3>
            <div className="guaranteeBox"><CheckCircle2 size={18} /> {car.guaranteeText}</div>
            <ul className="featureList">
              {car.features?.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </section>

          <section className="infoPanel">
            <h3><Clipboard size={18} /> ตารางผ่อนแบบฟรีดาวน์</h3>
            <div className="installmentTable">
              {car.installments?.map((row) => (
                <div key={row.years}>
                  <span>{row.years} ปี</span>
                  <strong>{row.amountText} บาท</strong>
                </div>
              ))}
            </div>
          </section>

          <section className="sharePreviewSection">
            <div className="sectionTitle">
              <Camera size={18} /> รูปสรุปสำหรับส่งให้เซลส์
            </div>
            <ShareCard ref={shareCardRef} car={car} carUrl={carUrl} />
          </section>
        </div>

        <div className="stickyActionBar">
          <button type="button" className="secondaryAction" onClick={copyLink}>
            <Copy size={18} /> คัดลอกลิงก์
          </button>
          <button type="button" className="captureAction" onClick={captureShareCard} disabled={isCapturing}>
            {isCapturing ? <Download size={18} /> : <Share2 size={18} />}
            {isCapturing ? 'กำลังสร้างรูป...' : 'แคปข้อมูลรถ'}
          </button>
        </div>
      </div>
    </section>
  );
}

const ShareCard = React.forwardRef(function ShareCard({ car, carUrl }, ref) {
  return (
    <div className="shareCard" ref={ref}>
      <div className="shareHeader">
        <div className="shareLogo">{SITE_CONFIG.logoText}</div>
        <div>
          <strong>{SITE_CONFIG.shopName}</strong>
          <span>ข้อมูลรถสำหรับส่งให้เซลส์</span>
        </div>
      </div>

      <img className="shareImage" src={getMainImage(car)} alt={car.title} crossOrigin="anonymous" loading="eager" decoding="async" />

      <div className="shareBody">
        <h3>{car.title}</h3>
        <div className="sharePrice">ราคา {formatPrice(car.price)} บาท</div>
        <div className="shareMonthly">ผ่อนเริ่มต้น {car.monthlyStartText} บาท / เดือน</div>

        <div className="shareSpecGrid">
          <div><span>ไมล์</span><strong>{car.mileageText}</strong></div>
          <div><span>เครื่องยนต์</span><strong>{car.engineText}</strong></div>
          <div><span>เกียร์</span><strong>{car.transmissionText}</strong></div>
          <div><span>ทะเบียน</span><strong>{car.plate}</strong></div>
        </div>

        <div className="shareInstallment">
          <strong>ตารางผ่อนแบบฟรีดาวน์</strong>
          {car.installments?.map((row) => (
            <div key={row.years}>
              <span>{row.years} ปี</span>
              <span>{row.amountText} บาท</span>
            </div>
          ))}
        </div>

        <div className="shareFooter">
          <span>รหัสรถ : {car.id}</span>
          <small>{SITE_CONFIG.financeNote}</small>
          <small className="shareUrl">{carUrl}</small>
        </div>
      </div>
    </div>
  );
});

function AdminApp() {
  const [session, setSession] = useState(null);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    if (!hasSupabaseConfig || !supabase) {
      setCheckingSession(false);
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session || null);
      setCheckingSession(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  if (!hasSupabaseConfig) return <MissingConfig />;
  if (checkingSession) return <AdminLoading />;
  if (!session) return <AdminLogin />;
  return <AdminDashboard session={session} />;
}

function MissingConfig() {
  return (
    <main className="adminShell">
      <section className="adminCard narrowCard">
        <h1>ยังไม่ได้เชื่อม Supabase</h1>
        <p>กรุณาเพิ่ม Environment Variables ใน Vercel ก่อนใช้งานหน้าแอดมิน</p>
        <code>VITE_SUPABASE_URL</code>
        <code>VITE_SUPABASE_ANON_KEY</code>
      </section>
    </main>
  );
}

function AdminLoading() {
  return (
    <main className="adminShell">
      <section className="adminCard narrowCard centerCard">
        <RefreshCw className="spinIcon" />
        <h1>กำลังตรวจสอบบัญชี</h1>
      </section>
    </main>
  );
}

function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleLogin(event) {
    event.preventDefault();
    setIsSubmitting(true);
    setError('');
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) setError(signInError.message);
    setIsSubmitting(false);
  }

  return (
    <main className="adminShell">
      <form className="adminCard narrowCard" onSubmit={handleLogin}>
        <div className="adminLogo">UM</div>
        <h1>เข้าสู่ระบบแอดมิน</h1>
        <p>ใช้บัญชีที่สร้างไว้ใน Supabase Authentication</p>

        {error && <div className="adminError">{error}</div>}

        <label>
          อีเมล
          <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" required placeholder="admin@email.com" />
        </label>
        <label>
          รหัสผ่าน
          <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" required placeholder="••••••••" />
        </label>

        <button className="adminPrimaryButton" disabled={isSubmitting} type="submit">
          {isSubmitting ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
        </button>
      </form>
    </main>
  );
}

function AdminDashboard({ session }) {
  const [cars, setCars] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [rawCarText, setRawCarText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStep, setSaveStep] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function loadAdminCars() {
    setIsLoading(true);
    setError('');
    try {
      const rows = await fetchCars({ includeHidden: true });
      setCars(rows);
    } catch (loadError) {
      console.error(loadError);
      setError(loadError.message || 'โหลดข้อมูลรถไม่สำเร็จ');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadAdminCars();
  }, []);

  function updateForm(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function updateInstallment(index, key, value) {
    setForm((current) => {
      const next = [...current.installments];
      next[index] = { ...next[index], [key]: value };
      return { ...current, installments: next };
    });
  }

  function resetForm({ keepMessage = false } = {}) {
    setForm(EMPTY_FORM);
    setSelectedFiles([]);
    setRawCarText('');
    setSaveStep('');
    if (!keepMessage) setMessage('');
    setError('');
  }

  function fillExampleText() {
    setRawCarText(`Isuzu MU-X 1.9 Active 2WD AT ปี 2023

ราคา 829,000 บาท
ผ่อนเริ่มต้น 13,xxx บาท / เดือน

ไมล์ 95,xxx Km
เครื่องยนต์ 1,900cc
เกียร์อัตโนมัติ 6AT

ตารางผ่อนแบบฟรีดาวน์ :
4 ปี 20,xxx
5 ปี 16,xxx
6 ปี 15,xxx
7 ปี 13,xxx
ทะเบียนรถ : XX-XXXX`);
  }

  function handleParseCarText() {
    if (!rawCarText.trim()) {
      setError('กรุณาวางข้อมูลรถก่อนกดแยกข้อมูลครับ');
      setMessage('');
      return;
    }

    const parsed = parseCarText(rawCarText);
    setForm((current) => ({
      ...current,
      ...parsed,
      dbId: current.dbId,
      status: current.status || 'available',
      sortOrder: current.sortOrder || 0,
      images: current.images || [],
      carCode: current.dbId ? (current.carCode || parsed.carCode) : parsed.carCode,
    }));
    setError('');
    setMessage('แยกข้อมูลเรียบร้อยครับ ตรวจสอบอีกครั้งแล้วกดบันทึกได้เลย');
  }

  function editCar(car) {
    setForm(dbCarToForm(car));
    setRawCarText('');
    setSelectedFiles([]);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function uploadImages(carCode) {
    if (!selectedFiles.length) return [];
    const urls = [];

    for (const file of selectedFiles) {
      const ext = file.name.split('.').pop() || 'jpg';
      const safeCode = sanitizeFileName(carCode || 'car');
      const safeName = sanitizeFileName(file.name.replace(/\.[^/.]+$/, ''));
      const path = `${safeCode}/${Date.now()}-${Math.random().toString(16).slice(2)}-${safeName}.${ext}`;

      setSaveStep(`กำลังอัปโหลดรูป ${urls.length + 1}/${selectedFiles.length} ...`);

      const { error: uploadError } = await supabase.storage
        .from('car-images')
        .upload(path, file, { upsert: false, contentType: file.type });

      if (uploadError) {
        throw new Error(`อัปโหลดรูปไม่สำเร็จ: ${uploadError.message}`);
      }

      const { data } = supabase.storage.from('car-images').getPublicUrl(path);
      urls.push(data.publicUrl);
    }

    return urls;
  }

  async function handleSave(event) {
    event.preventDefault();
    if (!supabase) {
      setError('ยังไม่ได้เชื่อม Supabase กรุณาตรวจ Environment Variables ใน Vercel');
      return;
    }
    if (!form.carCode.trim()) {
      setError('กรุณากรอกรหัสรถ เช่น UM-MUX-2023-001');
      return;
    }
    if (!form.title.trim()) {
      setError('กรุณากรอกชื่อรถ');
      return;
    }

    setIsSaving(true);
    setError('');
    setMessage('');
    setSaveStep('กำลังบันทึกข้อมูลรถเข้าฐานข้อมูล...');

    try {
      const baseCarForDb = formToCar(form);
      const basePayload = mapCarToDb(baseCarForDb);
      let savedRow = null;
      let successText = '';

      if (form.dbId) {
        const { data, error: updateError } = await supabase
          .from('cars')
          .update(basePayload)
          .eq('id', form.dbId)
          .select('*')
          .single();
        if (updateError) throw updateError;
        savedRow = data;
        successText = `✅ แก้ไขข้อมูลรถสำเร็จแล้ว: ${form.carCode}`;
      } else {
        const { data, error: insertError } = await supabase
          .from('cars')
          .insert(basePayload)
          .select('*')
          .single();
        if (insertError) throw insertError;
        savedRow = data;
        successText = `✅ เพิ่มรถใหม่สำเร็จแล้ว: ${form.carCode}`;
      }

      let uploadedUrls = [];
      if (selectedFiles.length) {
        try {
          uploadedUrls = await uploadImages(form.carCode);
          if (uploadedUrls.length) {
            setSaveStep('กำลังผูกรูปเข้ากับรถ...');
            const nextImages = [...(form.images || []), ...uploadedUrls];
            const { error: imageUpdateError } = await supabase
              .from('cars')
              .update({ images: nextImages })
              .eq('id', savedRow.id);
            if (imageUpdateError) throw imageUpdateError;
            successText += ` และอัปโหลดรูป ${uploadedUrls.length} รูปแล้ว`;
          }
        } catch (imageError) {
          successText += ` แต่รูปยังไม่ถูกอัปโหลด (${imageError.message})`;
        }
      }

      setMessage(successText);
      resetForm({ keepMessage: true });
      await loadAdminCars();
    } catch (saveError) {
      console.error(saveError);
      setError(`❌ บันทึกไม่สำเร็จ: ${saveError.message || 'ไม่ทราบสาเหตุ'} `);
    } finally {
      setSaveStep('');
      setIsSaving(false);
    }
  }

  async function hideCar(car) {
    const ok = window.confirm(`ต้องการซ่อนรถ ${car.title} ใช่ไหมครับ?`);
    if (!ok) return;
    setError('');
    setMessage('');
    const { error: hideError } = await supabase.from('cars').update({ status: 'hidden' }).eq('id', car.dbId);
    if (hideError) setError(hideError.message);
    else {
      setMessage('ซ่อนรถเรียบร้อยครับ');
      await loadAdminCars();
    }
  }

  async function logout() {
    await supabase.auth.signOut();
  }

  function removeImage(index) {
    setForm((current) => ({
      ...current,
      images: current.images.filter((_, imageIndex) => imageIndex !== index),
    }));
  }

  return (
    <main className="adminShell wideAdminShell">
      <header className="adminTopbar">
        <div>
          <span className="adminBadge">UM Admin</span>
          <h1>จัดการรถหน้าโชว์รูม</h1>
          <p>ล็อกอินด้วย {session.user.email}</p>
        </div>
        <div className="adminTopActions">
          <a className="adminGhostButton" href="/" target="_blank" rel="noreferrer"><Eye size={18} /> ดูหน้าเว็บ</a>
          <button className="adminGhostButton" onClick={logout}><LogOut size={18} /> ออกจากระบบ</button>
        </div>
      </header>

      <div className="adminGridLayout">
        <form className="adminCard carForm" onSubmit={handleSave}>
          <div className="formHeader">
            <div>
              <h2>{form.dbId ? 'แก้ไขรถ' : 'เพิ่มรถใหม่'}</h2>
              <p>ข้อมูลนี้จะแสดงที่หน้าเว็บลูกค้าทันทีหลังบันทึก</p>
            </div>
            <button type="button" className="adminGhostButton" onClick={resetForm}><Plus size={17} /> เคลียร์ฟอร์ม</button>
          </div>

          {saveStep && <div className="adminInfo"><RefreshCw className="spinIcon" /> {saveStep}</div>}
          {message && <div className="adminSuccess">{message}</div>}
          {error && <div className="adminError">{error}</div>}

          <section className="quickPasteBox">
            <div className="quickPasteHeader">
              <div>
                <h3><Sparkles size={18} /> วางข้อมูลรถช่องเดียว</h3>
                <p>ใช้แพทเทิร์นเดิมได้เลย ระบบจะตัดคำขายเกินจำเป็น เช่น “รถสวยมากคันนี้” แล้วแยกข้อมูลให้อัตโนมัติ</p>
              </div>
              <button type="button" className="adminGhostButton" onClick={fillExampleText}>ใส่ตัวอย่าง</button>
            </div>

            <textarea
              className="quickPasteArea"
              value={rawCarText}
              onChange={(event) => setRawCarText(event.target.value)}
              rows={12}
              placeholder={`วางข้อมูลรถตรงนี้ เช่น

Isuzu MU-X 1.9 Active 2WD AT ปี 2023

ราคา 829,000 บาท
ผ่อนเริ่มต้น 13,xxx บาท / เดือน

ไมล์ 95,xxx Km
เครื่องยนต์ 1,900cc
เกียร์อัตโนมัติ 6AT

ตารางผ่อนแบบฟรีดาวน์ :
4 ปี 20,xxx
5 ปี 16,xxx
6 ปี 15,xxx
7 ปี 13,xxx
ทะเบียนรถ : XX-XXXX`}
            />

            <div className="quickActionRow">
              <button type="button" className="parseButton" onClick={handleParseCarText}>
                <Sparkles size={18} /> แยกข้อมูลอัตโนมัติ
              </button>
              <button type="button" className="adminGhostButton" onClick={() => setRawCarText('')}>ล้างข้อความ</button>
            </div>
          </section>

          <section className="parsedEditorBox">
            <div className="parsedEditorTitle">
              <h3>ข้อมูลที่ระบบแยกให้</h3>
              <p>ตรวจแก้ได้ก่อนกดบันทึก โดยเฉพาะรหัสรถ ราคา และทะเบียน</p>
            </div>

          <div className="formGridTwo">
            <label>
              รหัสรถ
              <input value={form.carCode} onChange={(e) => updateForm('carCode', e.target.value)} placeholder="UM-MUX-2023-001" required />
            </label>
            <label>
              สถานะ
              <select value={form.status} onChange={(e) => updateForm('status', e.target.value)}>
                <option value="available">พร้อมขาย</option>
                <option value="reserved">จองแล้ว</option>
                <option value="sold">ขายแล้ว</option>
                <option value="hidden">ซ่อน</option>
              </select>
            </label>
          </div>

          <label>
            ชื่อรถ
            <input value={form.title} onChange={(e) => updateForm('title', e.target.value)} placeholder="Isuzu MU-X 1.9 Active 2WD AT ปี 2023" required />
          </label>

          <div className="formGridThree">
            <label>
              ยี่ห้อ
              <input value={form.brand} onChange={(e) => updateForm('brand', e.target.value)} placeholder="Isuzu" />
            </label>
            <label>
              รุ่น
              <input value={form.model} onChange={(e) => updateForm('model', e.target.value)} placeholder="MU-X" />
            </label>
            <label>
              ปี
              <input value={form.year} onChange={(e) => updateForm('year', e.target.value)} placeholder="2023" inputMode="numeric" />
            </label>
          </div>

          <div className="formGridTwo">
            <label>
              ราคา
              <input value={form.price} onChange={(e) => updateForm('price', e.target.value)} placeholder="829000" inputMode="numeric" />
            </label>
            <label>
              ผ่อนเริ่มต้น
              <input value={form.monthlyStartText} onChange={(e) => updateForm('monthlyStartText', e.target.value)} placeholder="13,xxx" />
            </label>
          </div>

          <div className="formGridTwo">
            <label>
              ไมล์
              <input value={form.mileageText} onChange={(e) => updateForm('mileageText', e.target.value)} placeholder="95,xxx Km" />
            </label>
            <label>
              เครื่องยนต์
              <input value={form.engineText} onChange={(e) => updateForm('engineText', e.target.value)} placeholder="1,900cc" />
            </label>
          </div>

          <div className="formGridTwo">
            <label>
              เกียร์
              <input value={form.transmissionText} onChange={(e) => updateForm('transmissionText', e.target.value)} placeholder="เกียร์อัตโนมัติ 6AT" />
            </label>
            <label>
              ทะเบียนรถ
              <input value={form.plate} onChange={(e) => updateForm('plate', e.target.value)} placeholder="XX-XXXX" />
            </label>
          </div>

          <div className="formGridTwo">
            <label>
              โปรโมชัน
              <input value={form.promotion} onChange={(e) => updateForm('promotion', e.target.value)} placeholder="ฟรีดาวน์ ฟรีจัด ฟรีโอน" />
            </label>
            <label>
              ข้อความรับประกัน
              <input value={form.guaranteeText} onChange={(e) => updateForm('guaranteeText', e.target.value)} placeholder="ไม่มีชนหนัก ไม่น้ำท่วม 100%" />
            </label>
          </div>

          <div className="installmentEditor">
            <h3>ตารางผ่อนฟรีดาวน์</h3>
            {form.installments.map((row, index) => (
              <div className="installmentEditRow" key={row.years}>
                <input value={row.years} onChange={(e) => updateInstallment(index, 'years', e.target.value)} inputMode="numeric" />
                <input value={row.amountText} onChange={(e) => updateInstallment(index, 'amountText', e.target.value)} placeholder="13,xxx" />
              </div>
            ))}
          </div>

          <label>
            รายการออปชัน / จุดเด่น ใส่บรรทัดละ 1 รายการ
            <textarea value={form.featuresText} onChange={(e) => updateForm('featuresText', e.target.value)} rows={5} placeholder={'ถุงลมนิรภัย เบรก ABS/EBD\nApple CarPlay\nกล้องมองภาพขณะถอยจอด'} />
          </label>

          </section>

          <section className="imageAdminBox">
            <h3><ImagePlus size={18} /> รูปรถ</h3>
            <label className="fileDrop">
              <UploadCloud size={26} />
              <span>เลือกรูปรถหลายรูปได้</span>
              <input type="file" accept="image/*" multiple onChange={(e) => setSelectedFiles(Array.from(e.target.files || []))} />
            </label>
            {!!selectedFiles.length && <p className="selectedFileText">เลือกแล้ว {selectedFiles.length} รูป จะอัปโหลดตอนกดบันทึก</p>}

            {!!form.images.length && (
              <div className="adminImageGrid">
                {form.images.map((image, index) => (
                  <div key={image} className="adminImageItem">
                    <img src={image} alt={`รูปรถ ${index + 1}`} />
                    <button type="button" onClick={() => removeImage(index)}><X size={14} /> ลบออกจากรายการ</button>
                  </div>
                ))}
              </div>
            )}
          </section>

          <button className="adminPrimaryButton saveButton" type="submit" disabled={isSaving}>
            <Save size={18} /> {isSaving ? 'กำลังบันทึก...' : 'บันทึกข้อมูลรถ'}
          </button>
        </form>

        <section className="adminCard carListPanel">
          <div className="formHeader">
            <div>
              <h2>รถทั้งหมด</h2>
              <p>{cars.length} รายการใน Supabase</p>
            </div>
            <button type="button" className="adminGhostButton" onClick={loadAdminCars}><RefreshCw size={17} /> รีเฟรช</button>
          </div>

          {isLoading ? (
            <div className="adminEmpty"><RefreshCw className="spinIcon" /> กำลังโหลด...</div>
          ) : cars.length === 0 ? (
            <div className="adminEmpty">ยังไม่มีรถในระบบ กรอกฟอร์มด้านซ้ายแล้วกดบันทึกได้เลยครับ</div>
          ) : (
            <div className="adminCarList">
              {cars.map((car) => (
                <article className="adminCarRow" key={car.dbId || car.id}>
                  <img src={getMainImage(car)} alt={car.title} />
                  <div>
                    <span className={`miniStatus ${STATUS_CLASS[car.status]}`}>{STATUS_LABEL[car.status]}</span>
                    <h3>{car.title}</h3>
                    <p>{car.id} • {formatPrice(car.price)} บาท • {car.plate}</p>
                    <div className="rowActions">
                      <button type="button" onClick={() => editCar(car)}><Pencil size={15} /> แก้ไข</button>
                      <button type="button" className="dangerTiny" onClick={() => hideCar(car)}><Trash2 size={15} /> ซ่อน</button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
