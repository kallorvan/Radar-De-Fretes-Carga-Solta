// Pasta em memória com a parte da File System Access API que o painel usa.
const espera = ms => new Promise(r => setTimeout(r, ms));

export class PastaFalsa {
  constructor(nome = "Radar Carga Solta") {
    this.kind = "directory"; this.name = nome;
    this.arquivos = new Map(); this.pastas = new Map();
    this.permissao = "granted"; this.escrevendo = 0; this.maxSimultaneo = 0; this.escritas = 0;
  }
  async queryPermission() { return this.permissao; }
  async requestPermission() { return this.permissao; }
  async getFileHandle(nome, { create = false } = {}) {
    if (!this.arquivos.has(nome)) {
      if (!create) throw Object.assign(new Error("não existe"), { name: "NotFoundError" });
      this.arquivos.set(nome, "");
    }
    const pasta = this;
    return {
      kind: "file", name: nome,
      // Blob de verdade (Node 18+ e navegador): o painel lê .text() e abre PDF por URL.createObjectURL
      async getFile() { const t = pasta.arquivos.get(nome); return new Blob([t], { type: /\.pdf$/i.test(nome) ? "application/pdf" : "text/plain" }); },
      async createWritable() {
        let buf = "";
        pasta.escrevendo++; pasta.maxSimultaneo = Math.max(pasta.maxSimultaneo, pasta.escrevendo);
        return {
          async write(t) { buf += t; await espera(5); },
          async close() { pasta.arquivos.set(nome, buf); pasta.escrevendo--; pasta.escritas++; },
        };
      },
    };
  }
  async getDirectoryHandle(nome, { create = false } = {}) {
    if (!this.pastas.has(nome)) {
      if (!create) throw Object.assign(new Error("não existe"), { name: "NotFoundError" });
      this.pastas.set(nome, new PastaFalsa(nome));
    }
    return this.pastas.get(nome);
  }
  async *entries() {
    for (const n of this.arquivos.keys()) yield [n, await this.getFileHandle(n)];
    for (const [n, p] of this.pastas) yield [n, p];
  }
  async removeEntry(nome) { this.arquivos.delete(nome); this.pastas.delete(nome); }
}

export const idbFalso = () => {
  const m = new Map();
  return { get: async k => m.get(k), put: async (k, v) => { m.set(k, v); }, del: async k => { m.delete(k); }, m };
};
