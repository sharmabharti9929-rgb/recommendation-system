import React, { useEffect, useState } from "react"
import { createRoot } from "react-dom/client"
import { BrowserRouter, Routes, Route, NavLink, useNavigate, useLocation } from "react-router-dom"
import { Film, Home, Sparkles, Search, Info, UserRound, SlidersHorizontal, Star } from "lucide-react"
import "./styles.css"

const API = "http://localhost:5000/api"

function Poster({ movie, large=false }) {
  const [bad, setBad] = useState(false)
  const fallback = "https://placehold.co/500x750/171722/ffffff?text=No+Poster"
  return <img className={large ? "poster large" : "poster"} src={bad || !movie.poster ? fallback : movie.poster}
    onError={() => setBad(true)} alt={movie.title} />
}

function Card({ movie }) {
  return <article className="card">
    <Poster movie={movie}/>
    <div className="card-body">
      <h3>{movie.title}</h3>
      <p>{movie.genres?.replaceAll("|", " • ")}</p>
      {movie.hybrid_score != null && <span className="score"><Star size={14}/> {movie.hybrid_score}</span>}
    </div>
  </article>
}

function Layout({ children }) {
  const nav = useNavigate()
  const loc = useLocation()
  const [q, setQ] = useState("")
  function submit(e){ e.preventDefault(); if(q.trim()) nav("/search?q="+encodeURIComponent(q.trim())) }
  return <div className="app">
    <header className="topbar">
      <div className="brand" onClick={() => nav("/")}>
        <div className="brand-icon"><Film/></div><span>Movie<span className="accent">Fusion</span></span>
      </div>
      <form className="search" onSubmit={submit}><Search size={18}/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search movies..."/></form>
      <nav>
        <NavLink className={loc.pathname==="/"?"active":""} to="/"><Home size={17}/>Home</NavLink>
        <NavLink to="/recommendations"><Sparkles size={17}/>For You</NavLink>
        <NavLink to="/browse"><Search size={17}/>Browse</NavLink>
        <NavLink to="/about"><Info size={17}/>About</NavLink>
      </nav>
    </header>
    <main>{children}</main>
    <footer>MovieFusion • Hybrid recommendation system • MovieLens data</footer>
  </div>
}

function HomePage(){
  const nav=useNavigate()
  return <section className="hero-page">
    <div className="hero">
      <div>
        <span className="eyebrow"><Sparkles size={15}/> AI-POWERED MOVIE DISCOVERY</span>
        <h1>Find your next<br/><span>favorite movie.</span></h1>
        <p>Personalized recommendations powered by a hybrid of content-based filtering and collaborative filtering.</p>
        <button onClick={()=>nav("/recommendations")} className="primary">Get My Recommendations <Sparkles size={17}/></button>
      </div>
      <div className="hero-art"><div className="ticket">🎬</div><div className="orb one"></div><div className="orb two"></div></div>
    </div>
    <div className="features">
      <div><Sparkles/><h3>Hybrid AI</h3><p>Content similarity + user preferences fused into one ranking.</p></div>
      <div><UserRound/><h3>Personalized</h3><p>Recommendations are generated for each MovieLens user.</p></div>
      <div><SlidersHorizontal/><h3>Tunable</h3><p>Adjust the collaborative/content blend with one slider.</p></div>
    </div>
  </section>
}

function Recommendations(){
  const [users,setUsers]=useState([])
  const [user,setUser]=useState("")
  const [alpha,setAlpha]=useState(.6)
  const [movies,setMovies]=useState([])
  const [loading,setLoading]=useState(false)
  useEffect(()=>{fetch(API+"/users").then(r=>r.json()).then(x=>{setUsers(x); if(x.length)setUser(x[0])})},[])
  useEffect(()=>{if(!user)return; setLoading(true); fetch(`${API}/recommendations?user_id=${user}&top_n=12&alpha=${alpha}`).then(r=>r.json()).then(setMovies).finally(()=>setLoading(false))},[user,alpha])
  return <section className="page">
    <div className="section-head"><div><span className="eyebrow">PERSONALIZED FOR YOU</span><h1>Recommended movies</h1><p>One hybrid score combines both models — no separate model selection.</p></div>
    <div className="controls"><label>User <select value={user} onChange={e=>setUser(e.target.value)}>{users.map(u=><option key={u} value={u}>User {u}</option>)}</select></label>
    <label>Hybrid balance <b>{Math.round(alpha*100)}% collaborative</b><input type="range" min="0" max="1" step=".05" value={alpha} onChange={e=>setAlpha(+e.target.value)}/></label></div></div>
    {loading?<div className="loading">Generating your recommendations...</div>:<div className="grid">{movies.map(m=><Card key={m.movieId} movie={m}/>)}</div>}
  </section>
}

function Browse(){
  const [movies,setMovies]=useState([])
  const [q,setQ]=useState("")
  async function search(){ if(!q.trim())return; const r=await fetch(API+"/search?q="+encodeURIComponent(q)); setMovies(await r.json())}
  return <section className="page"><div className="section-head"><div><span className="eyebrow">MOVIE LIBRARY</span><h1>Browse movies</h1><p>Search the MovieLens catalogue.</p></div></div>
    <div className="big-search"><Search/><input value={q} onChange={e=>setQ(e.target.value)} onKeyDown={e=>e.key==="Enter"&&search()} placeholder="Try “Toy Story”, “Matrix”, “Star Wars”..."/><button onClick={search}>Search</button></div>
    <div className="grid">{movies.map(m=><Card key={m.movieId} movie={m}/>)}</div>
  </section>
}

function SearchPage(){
 const p=new URLSearchParams(useLocation().search); const q=p.get("q")||""
 const [movies,setMovies]=useState([])
 useEffect(()=>{fetch(API+"/search?q="+encodeURIComponent(q)).then(r=>r.json()).then(setMovies)},[q])
 return <section className="page"><span className="eyebrow">SEARCH RESULTS</span><h1>Results for “{q}”</h1><div className="grid">{movies.map(m=><Card key={m.movieId} movie={m}/>)}</div></section>
}

function About(){
 return <section className="page prose"><span className="eyebrow">ABOUT THE PROJECT</span><h1>How MovieFusion works</h1>
 <div className="about-grid"><div><h2>Content-based filtering</h2><p>Movie genres are converted into TF-IDF vectors. Cosine similarity finds movies with similar genre profiles.</p></div>
 <div><h2>Collaborative filtering</h2><p>The user–movie rating matrix is factorized using TruncatedSVD. The reconstructed matrix estimates preferences for unseen movies.</p></div>
 <div><h2>Hybrid fusion</h2><p>Both scores are normalized to 0–1 and combined using a weighted sum. The final ranking is the only recommendation output.</p></div>
 <div><h2>Dataset</h2><p>The project uses MovieLens standard movies.csv and ratings.csv data from GroupLens. Poster URLs are optional and can be supplied in posters.csv.</p></div></div>
 </section>
}

function App(){return <Layout><Routes><Route path="/" element={<HomePage/>}/><Route path="/recommendations" element={<Recommendations/>}/><Route path="/browse" element={<Browse/>}/><Route path="/search" element={<SearchPage/>}/><Route path="/about" element={<About/>}/></Routes></Layout>}
createRoot(document.getElementById("root")).render(<BrowserRouter><App/></BrowserRouter>)
