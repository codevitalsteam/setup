export const Runs = () => {
  return (
    <div style={{ padding: 24, fontFamily: "system-ui" }}>
      <h1>Runs</h1>
      <button
        onClick={async () => {
          const r = await fetch("/api/health");
          alert(JSON.stringify(await r.json(), null, 2));
        }}
      >
        Ping API
      </button>
    </div>
  );
}

export default Runs;