import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach } from "vitest";

//! Cada prueba parte de un almacenamiento y un DOM limpios
beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
});
