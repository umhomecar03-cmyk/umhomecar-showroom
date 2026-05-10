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
  Search,
  Share2,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  X,
} from 'lucide-react';
import { cars } from './data/cars.js';
import { SITE_CONFIG } from './config/site.js';

const STATUS_LABEL = {
  available: 'พร้อมขาย',
  reserved: 'จองแล้ว',
  sold: 'ขายแล้ว',
};

const STATUS_CLASS = {
  available: 'statusAvailable',
  reserved: 'statusReserved',
  sold: 'statusSold',
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

export default function App() {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('available');
  const [priceRange, setPriceRange] = useState('all');
  const [selectedCar, setSelectedCar] = useState(null);
  const [toast, setToast] = useState('');

  useEffect(() => {
    const carId = getCarFromUrl();
    if (carId) {
      const found = cars.find((item) => item.id === carId);
      if (found) setSelectedCar(found);
    }

    const onPop = () => {
      const nextId = getCarFromUrl();
      setSelectedCar(cars.find((item) => item.id === nextId) || null);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(''), 2400);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const brands = useMemo(() => ['all', ...Array.from(new Set(cars.map((car) => car.brand).filter(Boolean)))], []);
  const [brand, setBrand] = useState('all');

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
  }, [query, brand, status, priceRange]);

  const stats = useMemo(() => {
    const available = cars.filter((car) => car.status === 'available').length;
    const reserved = cars.filter((car) => car.status === 'reserved').length;
    const sold = cars.filter((car) => car.status === 'sold').length;
    return { all: cars.length, available, reserved, sold };
  }, []);

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

        <div className="carGrid" aria-live="polite">
          {filteredCars.map((car) => (
            <CarCard key={car.id} car={car} onOpen={() => openCar(car)} />
          ))}
        </div>

        {filteredCars.length === 0 && (
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
  return (
    <section className="toolbarCard">
      <div className="searchBox">
        <Search size={18} />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="ค้นหารุ่นรถ / ยี่ห้อ / ปี / ทะเบียน"
        />
      </div>

      <div className="filterHeader">
        <div>
          <SlidersHorizontal size={17} /> ตัวกรอง
        </div>
        <span>{resultCount} คัน</span>
      </div>

      <div className="filterGrid">
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
      </div>
    </section>
  );
}

function CarCard({ car, onOpen }) {
  return (
    <article className="carCard" onClick={onOpen} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && onOpen()}>
      <div className="carImageWrap">
        <img src={getMainImage(car)} alt={car.title} loading="lazy" />
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
          <img src={car.images?.[activeImage] || getMainImage(car)} alt={car.title} />
          <div className={`statusBadge detailBadge ${STATUS_CLASS[car.status]}`}>{STATUS_LABEL[car.status]}</div>
        </div>

        {car.images?.length > 1 && (
          <div className="thumbRow">
            {car.images.map((img, index) => (
              <button key={img} type="button" className={activeImage === index ? 'activeThumb' : ''} onClick={() => setActiveImage(index)}>
                <img src={img} alt={`${car.title} รูปที่ ${index + 1}`} />
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

      <img className="shareImage" src={getMainImage(car)} alt={car.title} crossOrigin="anonymous" />

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
