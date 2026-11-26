import { useEffect, useState } from "react";
import { useAuth } from "@clerk/clerk-react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8080";

export default function ElevenMessages() {
  const { getToken } = useAuth();
  const [threads, setThreads] = useState([]);
  const [activeThread, setActiveThread] = useState(null);
  const [messages, setMessages] = useState([]);
  const [body, setBody] = useState("");
  const [search, setSearch] = useState("");
  const [players, setPlayers] = useState([]);
  const [error, setError] = useState("");

  const auth = async (json = false) => {
    const token = await getToken();
    const value = token ? { Authorization: "Bearer " + token } : {};
    return json ? { ...value, "Content-Type": "application/json" } : value;
  };

  const loadThreads = async () => {
    const response = await fetch(`${API_URL}/api/messages`, { headers: await auth() });
    if (response.ok) setThreads(await response.json());
  };

  const openThread = async (thread) => {
    setActiveThread(thread);
    setError("");
    const response = await fetch(`${API_URL}/api/messages/${thread.id}`, { headers: await auth() });
    if (response.ok) setMessages((await response.json()).reverse());
  };

  useEffect(() => { loadThreads(); }, [getToken]);

  useEffect(() => {
    if (search.trim().length < 2) { setPlayers([]); return; }
    const timer = setTimeout(async () => {
      const response = await fetch(`${API_URL}/api/search?q=${encodeURIComponent(search.trim())}`, { headers: await auth() });
      if (response.ok) {
        const result = await response.json();
        setPlayers(result.filter((item) => item.kind === "player"));
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [search, getToken]);

  const send = async (event) => {
    event.preventDefault();
    if (!body.trim()) return;
    if (!activeThread) {
      setError("Open or search for a player before sending.");
      return;
    }
    const response = await fetch(`${API_URL}/api/messages`, {
      method: "POST",
      headers: await auth(true),
      body: JSON.stringify({ conversationId: activeThread.id, body: body.trim() }),
    });
    if (response.status === 403) {
      setError("Only coaches, assistant coaches, and captains can post in Squad Groups.");
      return;
    }
    if (!response.ok) {
      setError(await response.text());
      return;
    }
    setBody("");
    await openThread(activeThread);
  };

  const startDm = async (player) => {
    const response = await fetch(`${API_URL}/api/messages`, {
      method: "POST",
      headers: await auth(true),
      body: JSON.stringify({ playerUuid: player.id, body: "Hi" }),
    });
    if (response.ok) {
      setSearch("");
      setPlayers([]);
      await loadThreads();
      setActiveThread({ id: (await response.json()).conversationId, title: player.name, kind: "DIRECT" });
      setMessages([]);
    }
  };

  return (
    <section className="eleven-messages-page">
      <aside className="eleven-inbox">
        <header><p>ELEVEN</p><h1>Messages</h1></header>
        <input className="eleven-message-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search ELE UUID or username" />
        {players.length > 0 && <div className="eleven-player-search-results">{players.map((player) => <button type="button" key={player.id} onClick={() => startDm(player)}><strong>{player.name}</strong><small>{player.id}</small></button>)}</div>}
        {threads.length === 0 && <div className="eleven-pinned-empty"><strong>Pinned Squad Group</strong><p>No squad conversation yet.</p></div>}
        {threads.map((thread) => (
          <button type="button" key={thread.id} className={`eleven-thread ${activeThread?.id === thread.id ? "active" : ""}`} onClick={() => openThread(thread)}>
            <b>{thread.kind === "SQUAD_GROUP" ? "SG" : thread.title?.charAt(0)}</b>
            <span><strong>{thread.title}</strong><small>{thread.preview || "Start a conversation"}</small></span>
          </button>
        ))}
      </aside>

      <section className="eleven-chat">
        {activeThread ? (
          <>
            <header><button type="button" className="eleven-chat-back" onClick={() => setActiveThread(null)}>‹</button><div><strong>{activeThread.title}</strong><small>{activeThread.kind === "SQUAD_GROUP" ? "Official squad group" : "Direct message"}</small></div></header>
            <div className="eleven-chat-messages">
              {messages.map((message) => <article key={message.id}><strong>{message.displayName}</strong><p>{message.body}</p></article>)}
              {messages.length === 0 && <p className="eleven-muted-copy">No messages yet.</p>}
            </div>
            {activeThread.kind === "SQUAD_GROUP"
              ? <footer className="eleven-chat-locked"><span>🔒</span><strong>Only coaches, assistant coaches, and captains can post</strong></footer>
              : <form className="eleven-chat-composer" onSubmit={send}><input value={body} onChange={(event) => setBody(event.target.value)} maxLength={4000} placeholder="Message…" /><button type="submit">➤</button></form>}
          </>
        ) : (
          <div className="eleven-chat-empty"><span>11</span><p>Select a conversation</p></div>
        )}
      </section>
      {error && <div className="eleven-toast" role="status">{error}</div>}
    </section>
  );
}
