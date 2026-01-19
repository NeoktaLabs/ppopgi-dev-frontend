import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";

import { ThirdwebProvider } from "thirdweb/react";
import { thirdwebClient } from "./thirdweb/client";
import { ETHERLINK_CHAIN } from "./thirdweb/etherlink";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThirdwebProvider client={thirdwebClient} activeChain={ETHERLINK_CHAIN}>
      <App />
    </ThirdwebProvider>
  </StrictMode>
);