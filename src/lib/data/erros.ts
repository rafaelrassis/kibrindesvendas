// Erro esperado de regra de negócio: as rotas em src/app/api traduzem direto
// pra resposta JSON, sem cada uma repetir a mesma checagem.
export class ErroDeNegocio extends Error {
  readonly status: number;

  constructor(mensagem: string, status = 400) {
    super(mensagem);
    this.name = "ErroDeNegocio";
    this.status = status;
  }
}
