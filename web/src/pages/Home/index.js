import React, {useEffect} from "react";


export const Home = () => {
    useEffect(() => {
        console.log("Home mounted");
    }, []);
  return (
    <div style={{ padding: 24, fontFamily: "system-ui" }}>
      <h1>Home</h1>
      <p>Try: <code>/runs</code></p>
    </div>
  );
}

export default Home;