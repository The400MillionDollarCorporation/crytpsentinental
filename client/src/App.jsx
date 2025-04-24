import { useState } from "react";
import reactLogo from "./assets/react.svg";
import viteLogo from "/vite.svg";
import "./App.css";
import CryptoSentinel from "./pages/CryptoSentinel";

function App() {
  const [count, setCount] = useState(0);

  return (
    <>
      <CryptoSentinel />
    </>
  );
}

export default App;
