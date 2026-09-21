import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { existsSync } from "node:fs";
import path from "node:path";
import AyudaPage from "../components/Ayuda/AyudaPage";
import { LO_ESENCIAL, TEMAS, TEXTO_PARA_COMPARTIR } from "../lib/ayuda";

//! La ayuda se abre SIN sesión (el enlace se manda por WhatsApp), así que se
//! pinta sin tienda de Redux, sin React Query y sin espació elegido: si algún
//! día alguien le mete una dependencia de esas, esta prueba se cae.
const renderAyuda = () => render(<MemoryRouter>{<AyudaPage />}</MemoryRouter>);

describe("La ayuda, paso a paso", () => {
  it("se pinta sin sesión", () => {
    renderAyuda();

    expect(screen.getByRole("heading", { name: "Cómo se usa, paso a paso" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Lo esencial" })).toBeInTheDocument();
  });

  it("están los siete temas, con sus pasos", () => {
    renderAyuda();

    for (const tema of TEMAS) {
      expect(screen.getByRole("heading", { name: tema.titulo })).toBeInTheDocument();
      for (const paso of tema.pasos) {
        expect(screen.getByText(paso)).toBeInTheDocument();
      }
    }
  });

  it("lo esencial son tres líneas y se ven todas", () => {
    renderAyuda();

    for (const linea of LO_ESENCIAL) {
      expect(screen.getByText(linea)).toBeInTheDocument();
    }
  });

  it("cada captura existe en public/ y dice qué se ve", () => {
    //! Un `src` mal escrito no rompe la compilación: se ve como una imagen rota
    //! justo en la página que tiene que explicar la app.
    for (const tema of TEMAS) {
      for (const imagen of tema.imagenes) {
        expect(imagen.alt.length).toBeGreaterThan(20);
        expect(existsSync(path.join(process.cwd(), "public", imagen.src))).toBe(true);
      }
    }
  });

  it("las capturas que se muestran son las de los temas", () => {
    renderAyuda();

    const imagenes = screen.getAllByRole("img");
    const esperadas = TEMAS.flatMap((tema) => tema.imagenes.map((i) => i.alt));
    expect(imagenes.map((i) => i.getAttribute("alt"))).toEqual(esperadas);
  });

  it("compartir arma el enlace de WhatsApp con el texto y la dirección de la ayuda", () => {
    renderAyuda();

    const boton = screen.getByRole("link", { name: /Compartir por WhatsApp/ });
    const href = boton.getAttribute("href");
    expect(href.startsWith("https://wa.me/?text=")).toBe(true);

    const texto = decodeURIComponent(href.split("text=")[1]);
    expect(texto).toContain("/ayuda");
    expect(texto).toContain("cómo se usa la app");
  });

  it("el texto de compartir lleva el enlace que se le pase", () => {
    expect(TEXTO_PARA_COMPARTIR("https://ejemplo.test/ayuda")).toContain(
      "https://ejemplo.test/ayuda"
    );
  });

  it("el índice lleva a cada tema", () => {
    renderAyuda();

    //! Los títulos llevan paréntesis ("Preparar el espacio (una sola vez)"): sin
    //! escaparlos, el paréntesis se lee como grupo de la expresión regular.
    const escapar = (texto) => texto.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    const indice = screen.getByRole("navigation", { name: "Temas" });
    for (const tema of TEMAS) {
      expect(
        within(indice).getByRole("link", { name: new RegExp(escapar(tema.titulo)) })
      ).toHaveAttribute("href", `#${tema.id}`);
    }
  });
});
