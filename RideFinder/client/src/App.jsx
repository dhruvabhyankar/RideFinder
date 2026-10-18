import { useEffect, useMemo, useState } from "react";
import { Search, SlidersHorizontal, ArrowUpRight, Heart, Gauge, Zap, Weight, X, ChevronDown, Bike as BikeIcon, ShieldCheck, ArrowRight } from "lucide-react";

const API = "http://localhost:4000/api";
const money = (value) => value == null ? "Price unavailable" : `₹${Number(value).toLocaleString("en-IN")}`;
const mileage = (b) => b.MILEAGE_ARAI ?? b.MILEAGE_OWNER_REPORTED;
const cc = (b) => b.DISPLACEMENT == null ? "—" : `${Number(b.DISPLACEMENT).toLocaleString("en-IN")} cc`;
const placeholder = "https://placehold.co/900x600/20231f/e9e9e4?text=Bike+image+unavailable";

function BikeCard({ bike, onDetails, saved, onSave }) {
  return <article className="bike-card">
    <div className="bike-photo">
      <img src={bike.IMAGES_URL || placeholder} alt={bike.NAME} loading="lazy" onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = placeholder; }} />
      <span className="photo-tag">{bike.BRAND || "Motorcycle"}</span>
      <button className={`save-btn ${saved ? "saved" : ""}`} onClick={() => onSave(bike.BIKE_ID)} aria-label="Save bike"><Heart size={18} fill={saved ? "currentColor" : "none"} /></button>
    </div>
    <div className="bike-info">
      <div className="bike-title-row"><div><p className="eyebrow">{bike.BRAND || "FEATURED BIKE"}</p><h3>{bike.NAME}</h3></div><ArrowUpRight className="card-arrow" size={20}/></div>
      <p className="price">{money(bike.PRICE)} <span>ex-showroom*</span></p>
      <div className="spec-row">
        <span><Gauge size={15}/>{mileage(bike) != null ? `${mileage(bike)} km/l` : "Mileage n/a"}</span>
        <span><Zap size={15}/>{cc(bike)}</span>
        <span><Weight size={15}/>{bike.KERB_WEIGHT != null ? `${bike.KERB_WEIGHT} kg` : "Weight n/a"}</span>
      </div>
      <button className="outline-btn" onClick={() => onDetails(bike.BIKE_ID)}>Explore bike <ArrowRight size={16}/></button>
    </div>
  </article>;
}


function DetailModal({ bike, onClose, onBooked, token, user, onLoginRequired }) {
  const [bookingOpen, setBookingOpen] = useState(false);
  const [form, setForm] = useState({ customerName: "", customerEmail: "", customerPhone: "", customerCity: "", notes: "" });
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState(null);
  const [bookingError, setBookingError] = useState("");
  useEffect(() => {
    if (user) setForm(old => ({ ...old, customerName: user.name || old.customerName, customerEmail: user.email || old.customerEmail, customerPhone: user.phone || old.customerPhone }));
  }, [user]);
  if (!bike) return null;
  const specs = [
    ["Brand", bike.BRAND], ["Price", money(bike.PRICE)], ["Engine", cc(bike)],
    ["Maximum power", bike.MAX_POWER != null ? `${bike.MAX_POWER} bhp` : null],
    ["Maximum torque", bike.MAX_TORQUE != null ? `${bike.MAX_TORQUE} Nm` : null],
    ["ARAI mileage", bike.MILEAGE_ARAI != null ? `${bike.MILEAGE_ARAI} km/l` : null],
    ["Owner-reported mileage", bike.MILEAGE_OWNER_REPORTED != null ? `${bike.MILEAGE_OWNER_REPORTED} km/l` : null],
    ["Transmission", bike.TRANSMISSION], ["Cooling", bike.COOLING_SYSTEM],
    ["Fuel tank", bike.FUEL_TANK_CAPACITY != null ? `${bike.FUEL_TANK_CAPACITY} L` : null],
    ["Kerb weight", bike.KERB_WEIGHT != null ? `${bike.KERB_WEIGHT} kg` : null],
    ["Seat height", bike.SEAT_HEIGHT != null ? `${bike.SEAT_HEIGHT} mm` : null],
    ["Top speed", bike.TOP_SPEED != null ? `${bike.TOP_SPEED} km/h` : null],
    ["Braking system", bike.BRAKING_SYSTEM], ["Chassis", bike.CHASSIS_TYPE],
  ].filter(([,v]) => v != null && v !== "");

  async function submitBooking(e) {
    e.preventDefault();
    setSending(true);
    setBookingError("");
    try {
      if (!token) {
        setBookingError("Please log in or create an account before booking.");
        onLoginRequired?.();
        return;
      }
      const response = await fetch(`${API}/bookings`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ bikeId: bike.BIKE_ID, ...form, customerName: user?.name || form.customerName, customerEmail: user?.email || form.customerEmail, customerPhone: user?.phone || form.customerPhone })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not submit booking.");
      setSuccess(data);
      onBooked?.();
    } catch (err) {
      setBookingError(err.message || "Could not submit booking. Check the backend and try again.");
    } finally {
      setSending(false);
    }
  }

  return <div className="modal-backdrop" onClick={onClose}><section className="detail-modal" onClick={e => e.stopPropagation()}>
    <button className="modal-close" onClick={onClose}><X size={20}/></button>
    <div className="detail-image"><img src={bike.IMAGES_URL || placeholder} alt={bike.NAME} onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = placeholder; }}/></div>
    <div className="detail-content"><p className="eyebrow">{bike.BRAND}</p><h2>{bike.NAME}</h2><p className="detail-price">{money(bike.PRICE)}</p>
      {success ? <div className="booking-success">
        <div className="success-icon">✓</div><p className="eyebrow">REQUEST RECEIVED</p><h3>Booking successful!</h3>
        <p>Your demo booking request for <strong>{bike.NAME}</strong> has been recorded.</p>
        <div className="booking-reference">Booking reference <strong>RF-{String(success.bookingId).padStart(5,"0")}</strong></div>
        <p className="fine-print">Your booking request has been received. Our team will contact you with the next steps.</p>
        <button className="hero-button success-done" onClick={onClose}>Done <ArrowRight size={16}/></button>
      </div> : bookingOpen ? <div className="booking-form-wrap">
        <button className="back-to-details" onClick={() => setBookingOpen(false)}>← Back to specifications</button>
        <h3>Book this bike</h3><p className="booking-intro">Enter your details to confirm your booking request.</p>
        <form className="booking-form" onSubmit={submitBooking}>
          <label>Full name<input required minLength={2} maxLength={150} autoComplete="name" value={form.customerName} onChange={e=>setForm({...form,customerName:e.target.value})} placeholder="Your full name"/></label>
          <label>Email address<input required type="email" maxLength={254} autoComplete="email" value={form.customerEmail} onChange={e=>setForm({...form,customerEmail:e.target.value})} placeholder="you@example.com"/></label>
          <label>Phone number<input required type="tel" minLength={7} maxLength={30} autoComplete="tel" value={form.customerPhone} onChange={e=>setForm({...form,customerPhone:e.target.value})} placeholder="+91 98765 43210"/></label>
          <label>City <span className="optional">(optional)</span><input maxLength={100} autoComplete="address-level2" value={form.customerCity} onChange={e=>setForm({...form,customerCity:e.target.value})} placeholder="Your city"/></label>
          <label>Message <span className="optional">(optional)</span><textarea maxLength={1000} rows={3} value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} placeholder="Anything you'd like us to know?"/></label>
          <p className="privacy-note">Your details will be used to process your booking request.</p>
          {bookingError && <div className="error-banner">{bookingError}</div>}
          <button className="hero-button submit-booking" type="submit" disabled={sending}>{sending ? "Submitting..." : "Confirm booking"} <ArrowRight size={16}/></button>
        </form>
      </div> : <>
        <div className="detail-specs">{specs.map(([label,value]) => <div key={label} className="detail-spec"><span>{label}</span><strong>{value}</strong></div>)}</div>
        <p className="fine-print">Specifications and pricing may vary by location and variant.</p>
        <button className="hero-button book-bike-btn" onClick={() => { if (!token) { onLoginRequired?.(); } else { setBookingOpen(true); } }}>Book this bike <ArrowRight size={17}/></button>
      </>}
    </div>
  </section></div>;
}


function AuthModal({ mode, onClose, onSuccess, onMode }) {
  const [form, setForm] = useState({ name: "", email: "", password: "", phone: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(e) {
    e.preventDefault(); setBusy(true); setError("");
    try {
      const endpoint = mode === "register" ? "register" : "login";
      const response = await fetch(`${API}/auth/${endpoint}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not complete request.");
      onSuccess(data);
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  return <div className="modal-backdrop" onClick={onClose}><section className="auth-modal" onClick={e=>e.stopPropagation()}>
    <button className="modal-close" onClick={onClose}><X size={20}/></button>
    <div className="auth-brand"><span className="brand-icon"><BikeIcon size={22}/></span><span>RIDE<span className="accent">FINDER</span></span></div>
    <p className="eyebrow">{mode === "register" ? "JOIN THE RIDE" : "WELCOME BACK"}</p>
    <h2>{mode === "register" ? "Create your account." : "Good to see you again."}</h2>
    <p className="auth-sub">{mode === "register" ? "Create an account to book bikes and keep track of your requests." : "Log in to view your bookings and continue exploring."}</p>
    <form className="booking-form" onSubmit={submit}>
      {mode === "register" && <>
        <label>Full name<input required minLength={2} maxLength={150} autoComplete="name" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Your full name"/></label>
        <label>Phone number <span className="optional">(optional)</span><input type="tel" maxLength={30} autoComplete="tel" value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} placeholder="+91 98765 43210"/></label>
      </>}
      <label>Email address<input required type="email" autoComplete="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} placeholder="you@example.com"/></label>
      <label>Password<input required type="password" minLength={mode==="register"?8:1} maxLength={72} autoComplete={mode==="register"?"new-password":"current-password"} value={form.password} onChange={e=>setForm({...form,password:e.target.value})} placeholder={mode==="register"?"At least 8 characters":"Your password"}/></label>
      {error && <div className="error-banner">{error}</div>}
      <button className="hero-button submit-booking" type="submit" disabled={busy}>{busy ? "Please wait..." : mode==="register" ? "Create account" : "Log in"} <ArrowRight size={16}/></button>
    </form>
    <p className="auth-switch">{mode==="register"?"Already have an account?":"New to RideFinder?"} <button onClick={()=>onMode(mode==="register"?"login":"register")}>{mode==="register"?"Log in":"Create an account"}</button></p>
  </section></div>;
}

function MyBookings({ token, onClose }) {
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetch(`${API}/my-bookings`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json().then(data => { if (!r.ok) throw new Error(data.error || "Could not load bookings."); return data; }))
      .then(data => setItems(data.items || []))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [token]);
  return <div className="modal-backdrop" onClick={onClose}><section className="bookings-modal" onClick={e=>e.stopPropagation()}>
    <button className="modal-close" onClick={onClose}><X size={20}/></button>
    <p className="eyebrow">YOUR ACCOUNT</p><h2>My bookings</h2><p className="auth-sub">All your booking requests, in one place.</p>
    {loading ? <p className="bookings-message">Loading your bookings...</p> : error ? <div className="error-banner">{error}</div> : items.length ? <div className="account-booking-list">{items.map(item=><article className="account-booking" key={item.BOOKING_ID}>
      <img src={item.IMAGES_URL || placeholder} alt={item.BIKE_NAME} onError={e=>{e.currentTarget.onerror=null;e.currentTarget.src=placeholder;}}/>
      <div className="account-booking-info"><p className="eyebrow">{item.BIKE_BRAND}</p><h3>{item.BIKE_NAME}</h3><strong>{money(item.BIKE_PRICE)}</strong><span>Booking #{item.BOOKING_ID} · {item.BOOKING_STATUS}</span><small>{item.CREATED_AT ? new Date(item.CREATED_AT).toLocaleString() : ""}</small></div>
    </article>)}</div> : <div className="empty-state"><BikeIcon size={28}/><h3>No bookings yet</h3><p>Your booking requests will appear here.</p></div>}
  </section></div>;
}

export default function App() {
  const [items, setItems] = useState([]);
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState("login");
  const [accountView, setAccountView] = useState(false);
  const [session, setSession] = useState(() => {
    try { return { token: localStorage.getItem("ridefinder-token") || "", user: JSON.parse(localStorage.getItem("ridefinder-user") || "null") }; }
    catch { return { token: "", user: null }; }
  });
  const [brands, setBrands] = useState([]);
  const [total, setTotal] = useState(0);
  const [query, setQuery] = useState("");
  const [brand, setBrand] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [minCc, setMinCc] = useState("");
  const [maxCc, setMaxCc] = useState("");
  const [minMileage, setMinMileage] = useState("");
  const [sort, setSort] = useState("price_asc");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [detail, setDetail] = useState(null);
  const [saved, setSaved] = useState(() => {
    try { return JSON.parse(localStorage.getItem("ridefinder-saved") || "[]"); } catch { return []; }
  });
  const [filtersOpen, setFiltersOpen] = useState(true);

  useEffect(() => {
    fetch(`${API}/filters`).then(r => { if (!r.ok) throw new Error("Could not load filters"); return r.json(); })
      .then(data => setBrands(data.brands || [])).catch(() => setError("Can't connect to the API yet. Start the Oracle backend and refresh."));
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ q: query, brand, minPrice, maxPrice, minCc, maxCc, minMileage, sort, page: String(page), limit: "12" });
    setLoading(true);
    fetch(`${API}/bikes?${params}`, { signal: controller.signal })
      .then(r => { if (!r.ok) throw new Error("Could not load bikes"); return r.json(); })
      .then(data => { setItems(data.items || []); setTotal(data.total || 0); setError(""); })
      .catch(e => { if (e.name !== "AbortError") setError("Unable to load bikes. Check that Oracle is running and the backend is connected."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [query, brand, minPrice, maxPrice, minCc, maxCc, minMileage, sort, page]);

  const pages = Math.max(1, Math.ceil(total / 12));
  const reset = () => { setQuery(""); setBrand(""); setMinPrice(""); setMaxPrice(""); setMinCc(""); setMaxCc(""); setMinMileage(""); setSort("price_asc"); setPage(1); };
  const toggleSave = (id) => setSaved(old => {
    const next = old.includes(id) ? old.filter(x => x !== id) : [...old, id];
    localStorage.setItem("ridefinder-saved", JSON.stringify(next));
    return next;
  });
  const openDetails = async (id) => {
    try { const r = await fetch(`${API}/bikes/${id}`); if (!r.ok) throw new Error(); setDetail(await r.json()); }
    catch { setError("Could not load the bike details."); }
  };

  return <div className="app-shell">
    <header className="topbar"><a className="brandmark" href="#"><span className="brand-icon"><BikeIcon size={22}/></span><span>RIDE<span className="accent">FINDER</span></span></a>
      <nav><a href="#catalogue">Explore bikes</a><a href="#why">Why RideFinder</a></nav>
      <div className="account-actions">{session.token && session.user ? <><button className="account-link" onClick={() => setAccountView(true)}>My bookings</button><button className="nav-cta" onClick={() => { localStorage.removeItem("ridefinder-token"); localStorage.removeItem("ridefinder-user"); setSession({token:"",user:null}); }}>Log out <ArrowUpRight size={16}/></button><span className="account-greeting">Hi, {session.user.name.split(" ")[0]}</span></> : <><button className="account-link" onClick={() => {setAuthMode("login");setAuthOpen(true);}}>Log in</button><button className="nav-cta" onClick={() => {setAuthMode("register");setAuthOpen(true);}}>Create account <ArrowUpRight size={16}/></button></>}</div>
    </header>
    <main>
      <section className="hero">
        <div className="hero-grid"></div>
        <div className="hero-copy"><div className="hero-kicker"><span className="pulse"></span> YOUR NEXT CHAPTER STARTS HERE</div>
          <h1>Find the bike<br/>that <em>moves you.</em></h1>
          <p className="hero-sub">Less scrolling. More riding. Explore bikes, compare specs, and find the one that feels like yours.</p>
          <a className="hero-button" href="#catalogue">Explore the collection <ArrowRight size={17}/></a>
          <div className="hero-stats"><div><strong>100+</strong><span>Bike specifications</span></div><div><strong>Smart</strong><span>Search & filters</span></div><div><strong>One</strong><span>Next great ride</span></div></div>
        </div>
        <div className="hero-visual"><div className="hero-orbit orbit-one"></div><div className="hero-orbit orbit-two"></div><div className="hero-image-card">
          <img src="https://www.royalenfield.com/content/dam/royal-enfield/hunter-350/studio-shots/dapper-white.png" alt="Featured Royal Enfield Hunter 350" onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = placeholder; }}/>
          <div className="hero-image-caption"><span>EDITOR'S PICK</span><strong>Make every road yours.</strong></div>
        </div><div className="floating-label"><span className="float-dot"></span> FIND YOUR FREEDOM</div></div>
      </section>

      <section className="trust-strip" id="why"><div><ShieldCheck size={19}/><span>Specs at a glance</span></div><div><SlidersHorizontal size={19}/><span>Filters that fit you</span></div><div><Heart size={19}/><span>Your shortlist, saved</span></div><div><Gauge size={19}/><span>Compare what matters</span></div></section>

      <section className="catalogue" id="catalogue">
        <div className="section-heading"><div><p className="eyebrow">THE COLLECTION</p><h2>Find your kind of <em>ride.</em></h2><p className="section-desc">Start with a feeling. Narrow it down with the details.</p></div><div className="result-count"><strong>{total}</strong><span> bikes to explore</span></div></div>
        <div className="searchbar"><Search size={20}/><input value={query} onChange={e => { setQuery(e.target.value); setPage(1); }} placeholder="Search by bike name or brand..." aria-label="Search bikes"/><kbd>SEARCH</kbd></div>
        <div className="catalogue-layout">
          <aside className={`filter-panel ${filtersOpen ? "open" : "closed"}`}>
            <button className="filter-heading" onClick={() => setFiltersOpen(v => !v)}><span><SlidersHorizontal size={18}/> Refine your search</span><ChevronDown size={17}/></button>
            {filtersOpen && <div className="filter-body">
              <label className="field-label">Brand<select value={brand} onChange={e => { setBrand(e.target.value); setPage(1); }}><option value="">All brands</option>{brands.map(b => <option key={b} value={b}>{b}</option>)}</select></label>
              <div className="filter-group"><p className="field-label">Budget (₹)</p><div className="two-inputs"><input type="number" min="0" placeholder="Min price" value={minPrice} onChange={e => { setMinPrice(e.target.value); setPage(1); }}/><input type="number" min="0" placeholder="Max price" value={maxPrice} onChange={e => { setMaxPrice(e.target.value); setPage(1); }}/></div></div>
              <div className="filter-group"><p className="field-label">Engine size (cc)</p><div className="two-inputs"><input type="number" min="0" placeholder="Min cc" value={minCc} onChange={e => { setMinCc(e.target.value); setPage(1); }}/><input type="number" min="0" placeholder="Max cc" value={maxCc} onChange={e => { setMaxCc(e.target.value); setPage(1); }}/></div></div>
              <label className="field-label">Minimum mileage (km/l)<input type="number" min="0" placeholder="e.g. 35" value={minMileage} onChange={e => { setMinMileage(e.target.value); setPage(1); }}/></label>
              <label className="field-label">Sort by<select value={sort} onChange={e => { setSort(e.target.value); setPage(1); }}><option value="price_asc">Price: low to high</option><option value="price_desc">Price: high to low</option><option value="mileage_desc">Mileage: high to low</option><option value="displacement_desc">Engine: largest first</option><option value="power_desc">Power: highest first</option><option value="name_asc">Name: A to Z</option></select></label>
              <button className="reset-btn" onClick={reset}>Reset all filters <X size={14}/></button>
            </div>}
          </aside>
          <div className="results-area">
            <div className="results-toolbar"><span>Showing <strong>{items.length ? (page - 1) * 12 + 1 : 0}–{Math.min(page * 12, total)}</strong> of <strong>{total}</strong> results</span><span className="desktop-sort">Sorted by {sort.replaceAll("_", " ")}</span></div>
            {error && <div className="error-banner">{error}</div>}
            {loading ? <div className="loading-grid">{Array.from({length:6},(_,i)=><div className="skeleton" key={i}/>)}</div> :
              items.length ? <div className="bike-grid">{items.map(b => <BikeCard key={b.BIKE_ID} bike={b} onDetails={openDetails} saved={saved.includes(b.BIKE_ID)} onSave={toggleSave}/>)}</div> :
              <div className="empty-state"><Search size={30}/><h3>No bikes found</h3><p>Try a different search or relax a filter.</p><button className="outline-btn" onClick={reset}>Clear filters</button></div>}
            {pages > 1 && <div className="pagination"><button disabled={page <= 1} onClick={() => {setPage(p=>p-1); document.getElementById("catalogue").scrollIntoView({behavior:"smooth"});}}>Previous</button><span>Page {page} of {pages}</span><button disabled={page >= pages} onClick={() => {setPage(p=>p+1); document.getElementById("catalogue").scrollIntoView({behavior:"smooth"});}}>Next <ArrowRight size={15}/></button></div>}
          </div>
        </div>
      </section>
      <section className="closing-cta"><div><p className="eyebrow">THE ROAD IS CALLING</p><h2>Your next ride is<br/><em>closer than you think.</em></h2></div><a href="#catalogue" className="hero-button">Find your bike <ArrowRight size={17}/></a></section>
    </main>
    <footer><a className="brandmark" href="#"><span className="brand-icon"><BikeIcon size={20}/></span><span>RIDE<span className="accent">FINDER</span></span></a><span>Find your next ride.</span><span></span></footer>
    <DetailModal bike={detail} onClose={() => setDetail(null)} token={session.token} user={session.user} onLoginRequired={() => {setAuthMode("login");setAuthOpen(true);}} onBooked={() => {}}/>
    {authOpen && <AuthModal mode={authMode} onClose={() => setAuthOpen(false)} onMode={setAuthMode} onSuccess={data => {localStorage.setItem("ridefinder-token",data.token);localStorage.setItem("ridefinder-user",JSON.stringify(data.user));setSession({token:data.token,user:data.user});setAuthOpen(false);}}/>}
    {accountView && session.token && <MyBookings token={session.token} onClose={() => setAccountView(false)}/>}
  </div>;
}
