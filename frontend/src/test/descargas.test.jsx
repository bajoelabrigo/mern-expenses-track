import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Downloads from "../components/Home/Downloads";
import { APP_RELEASE, releaseDate } from "../lib/appRelease";

const renderPagina = () =>
  render(
    <MemoryRouter>
      <Downloads />
    </MemoryRouter>
  );

describe("Descargas", () => {
  it("ofrece el APK con su versión y baja el archivo, no lo abre", () => {
    renderPagina();

    const boton = screen.getByRole("link", { name: /Descargar para Android/ });
    expect(boton).toHaveAttribute("href", APP_RELEASE.file);
    //! Sin `download` el navegador intentaría abrir el .apk en vez de guardarlo
    expect(boton).toHaveAttribute("download");
    expect(screen.getByText(new RegExp(`Versión ${APP_RELEASE.version}`))).toBeInTheDocument();
  });

  it("dice la fecha de la compilación en palabras", () => {
    renderPagina();
    expect(screen.getByText(new RegExp(releaseDate()))).toBeInTheDocument();
  });

  it("explica cómo instalarla en iPhone, que no admite el archivo", () => {
    renderPagina();

    expect(screen.getByRole("heading", { name: "iPhone o iPad" })).toBeInTheDocument();
    //! En iOS no existe "Instalar": hay que pasar por Compartir
    expect(screen.getByText(/Toca el botón Compartir/)).toBeInTheDocument();
    expect(screen.getByText(/Baja y elige "Añadir a pantalla de inicio"/)).toBeInTheDocument();
  });
});
