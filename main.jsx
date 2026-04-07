import React from "react";
import { createRoot } from "react-dom/client";
import SightReadingTrainer from "./piano-reader.jsx";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <SightReadingTrainer />
  </React.StrictMode>
);
