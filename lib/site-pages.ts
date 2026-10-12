import accountPage from "../paginas/conta.html?raw";
import page0 from "../paginas/index.html?raw";
import page1 from "../paginas/bebidas.html?raw";
import page2 from "../paginas/servicos.html?raw";
import page3 from "../paginas/contato.html?raw";
import page4 from "../paginas/delivery.html?raw";

const sourcePages: Record<string, string> = {
  "/conta.html": accountPage,
  "/": page0,
  "/bebidas.html": page1,
  "/servicos.html": page2,
  "/contato.html": page3,
  "/delivery.html": page4,
};

// O HTML usa caminhos relativos para permitir a abertura dos arquivos locais.
// Nas respostas do servidor, os arquivos de public ficam na raiz do site.
export const pages: Record<string, string> = Object.fromEntries(
  Object.entries(sourcePages).map(([path, html]) => [
    path,
    html.replaceAll("../public/", "/"),
  ]),
);

pages["/index.html"] = pages["/"];
