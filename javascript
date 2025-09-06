(function(){
  // Grab references to all important DOM elements
  const els = {
    weatherContent: document.getElementById('weatherContent'),
    weatherMeta: document.getElementById('weatherMeta'),
    cryptoContent: document.getElementById('cryptoContent'),
    cryptoMeta: document.getElementById('cryptoMeta'),
    ghContent: document.getElementById('ghContent'),
    ghMeta: document.getElementById('ghMeta'),
    ghUser: document.getElementById('ghUser'),
    coin: document.getElementById('coin'),
    refresh: document.getElementById('refresh'),
    useGeo: document.getElementById('useGeo')
  };

  // Formatters for numbers, dates, and currency → makes UI consistent and professional
  const fmt = new Intl.NumberFormat(undefined, {maximumFractionDigits: 2});
  const timeFmt = new Intl.DateTimeFormat(undefined, {hour:'2-digit', minute:'2-digit'});
  const dateFmt = new Intl.DateTimeFormat(undefined, {month:'short', day:'2-digit'});
  const currencyFmt = new Intl.NumberFormat(undefined, {style:'currency', currency:'USD'});

  // Utility functions for showing loading state and error messages
  function setLoading(el, h){ el.innerHTML = <div class="skeleton" style="height:${h}px"></div>; }
  function setError(el, msg){ el.innerHTML = <div class="error">${msg}</div>; }

  // -------------------- WEATHER API (Open-Meteo) --------------------
  // Fetches current temperature, humidity, feels-like temp, wind speed
  async function loadWeather(lat, lon){
    try{
      setLoading(els.weatherContent, 72);
      // Build URL with query params
      const url = new URL('https://api.open-meteo.com/v1/forecast');
      url.searchParams.set('latitude', lat);
      url.searchParams.set('longitude', lon);
      url.searchParams.set('current', 'temperature_2m,relative_humidity_2m,apparent_temperature,wind_speed_10m');

      const res = await fetch(url);
      if(!res.ok) throw new Error('Weather unavailable');

      const data = await res.json();
      const c = data.current; // destructure current weather object

      // Update UI with weather data
      els.weatherContent.innerHTML = 
        <div class="row">
          <div>
            <div class="value">${fmt.format(c.temperature_2m)}°C <span class="muted small">feels ${fmt.format(c.apparent_temperature)}°</span></div>
            <div class="muted">Humidity ${fmt.format(c.relative_humidity_2m)}% • Wind ${fmt.format(c.wind_speed_10m)} km/h</div>
          </div>
          <div class="pill">Updated <span>${timeFmt.format(new Date())}</span></div>
        </div>;

      els.weatherMeta.textContent = Lat ${fmt.format(lat)}, Lon ${fmt.format(lon)};
    }catch(e){ 
      setError(els.weatherContent, 'Could not fetch weather.');
      console.error(e);
    }
  }

  // -------------------- CRYPTO API (CoinGecko) --------------------
  // Fetches USD price of selected coin + 24h percentage change
  async function loadCrypto(coinId){
    try{
      setLoading(els.cryptoContent, 72);
      const res = await fetch(https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd&include_24hr_change=true);
      if(!res.ok) throw new Error('Crypto unavailable');

      const data = await res.json();
      const price = data[coinId]?.usd; // optional chaining: avoids crash if data is missing
      const change = data[coinId]?.usd_24h_change;

      // Decide color based on positive/negative change
      const dir = change >= 0 ? 'success' : 'error';
      const sign = change >= 0 ? '+' : '';

      els.cryptoContent.innerHTML = 
        <div class="row">
          <div>
            <div class="value">${currencyFmt.format(price)}</div>
            <div class="muted">24h: <span class="${dir}">${sign}${fmt.format(change)}%</span></div>
          </div>
          <div class="pill">${coinId}</div>
        </div>;

      els.cryptoMeta.textContent = Source: CoinGecko • ${dateFmt.format(new Date())};
    }catch(e){ 
      setError(els.cryptoContent, 'Could not fetch crypto price.');
      console.error(e);
    }
  }

  // -------------------- GITHUB API --------------------
  // Fetches the 5 most recently updated repos of a user
  async function loadRepos(user){
    try{
      setLoading(els.ghContent, 96);
      const res = await fetch(https://api.github.com/users/${encodeURIComponent(user)}/repos?sort=updated&per_page=5);
      if(!res.ok) throw new Error('GitHub unavailable');

      const repos = await res.json();

      if(!Array.isArray(repos) || repos.length === 0){
        els.ghContent.innerHTML = '<div class="warn">No public repos found for this user.</div>';
        els.ghMeta.textContent = '';
        return;
      }

      // Map over repos → create list items with name, stars, last update, and link
      const list = repos.map(r=>{
        const updated = new Date(r.updated_at);
        return 
          <div class="item">
            <div class="left">
              <strong>${r.name}</strong>
              <span class="mini">★ ${fmt.format(r.stargazers_count)} • Updated ${dateFmt.format(updated)} at ${timeFmt.format(updated)}</span>
            </div>
            <a class="btn" href="${r.html_url}" target="_blank" rel="noopener">Open</a>
          </div>
      }).join('');

      els.ghContent.innerHTML = <div class="list">${list}</div>;
      els.ghMeta.textContent = User: ${user} • Showing latest ${Math.min(repos.length,5)} repos;
    }catch(e){ 
      setError(els.ghContent, 'Could not fetch repos.');
      console.error(e);
    }
  }

  // -------------------- GEOLOCATION HELPER --------------------
  // Uses browser Geolocation API to get user coordinates
  function getGeo(){
    return new Promise((resolve, reject)=>{
      if(!('geolocation' in navigator)) return reject(new Error('No geolocation'));
      navigator.geolocation.getCurrentPosition(
        (pos)=> resolve({lat: pos.coords.latitude, lon: pos.coords.longitude}),
        (err)=> reject(err),
        {enableHighAccuracy:false, timeout: 8000, maximumAge: 600000}
      );
    });
  }

  // -------------------- REFRESH FUNCTION --------------------
  // Triggers all API calls (crypto + repos + weather)
  async function refreshAll(){
    const coinId = els.coin.value;
    const ghUser = els.ghUser.value.trim() || 'octocat';
    loadCrypto(coinId);
    loadRepos(ghUser);

    // Weather is loaded from cached geo if available (localStorage)
    const cached = localStorage.getItem('geo');
    if(cached){
      try{ 
        const {lat, lon} = JSON.parse(cached);
        loadWeather(lat, lon); 
      } catch{ /* ignore errors */ }
    }
  }

  // -------------------- EVENT LISTENERS --------------------
  els.refresh.addEventListener('click', refreshAll);
  els.coin.addEventListener('change', ()=> loadCrypto(els.coin.value));
  els.ghUser.addEventListener('change', ()=> loadRepos(els.ghUser.value));
  els.useGeo.addEventListener('click', async ()=>{
    els.useGeo.disabled = true;
    els.useGeo.textContent = 'Locating…';
    try{
      const {lat, lon} = await getGeo();
      localStorage.setItem('geo', JSON.stringify({lat, lon}));
      await loadWeather(lat, lon);
      els.weatherMeta.textContent += ' • Using your device location';
    }catch(e){
      setError(els.weatherContent, 'Location blocked. Click Refresh after allowing.');
    }finally{
      els.useGeo.disabled = false;
      els.useGeo.textContent = 'Use my location';
    }
  });

  // -------------------- INITIAL LOAD --------------------
  refreshAll();
})();
