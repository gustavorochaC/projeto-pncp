import Link from "next/link";
import { Button, Card } from "@pncp/ui";

export default function LandingPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-7xl flex-col justify-center px-6 py-16">
      <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr]">
        <section className="space-y-8">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-teal-700">
            Plataforma de inteligência em licitações
          </p>
          <div className="space-y-5">
            <h1 className="max-w-4xl text-5xl font-semibold leading-tight text-slate-950">
              Descubra, priorize e interprete editais com busca profissional e IA local.
            </h1>
            <p className="max-w-2xl text-lg leading-8 text-slate-600">
              Um SaaS pensado para times comerciais e analistas que precisam filtrar oportunidades públicas, entender riscos e agir rápido.
            </p>
          </div>
          <div className="flex gap-3">
            <Link href="/dashboard">
              <Button className="h-12 px-6 text-base">Entrar no painel</Button>
            </Link>
            <Link href="/login">
              <Button variant="secondary" className="h-12 px-6 text-base">
                Acessar conta
              </Button>
            </Link>
          </div>
        </section>

        <Card className="space-y-5">
          <div className="rounded-[1.75rem] bg-slate-950 p-6 text-slate-50">
            <p className="text-sm text-slate-300">Resumo automático</p>
            <p className="mt-3 text-lg leading-8">
              “O edital exige habilitação técnica com atestado compatível, prazo em 22/03 e apresenta risco de documentação complementar não detalhada.”
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              "Busca por UF, órgão, modalidade e status",
              "Detalhe de edital com anexos e linha do tempo",
              "Favoritos, alertas e histórico de pesquisa",
              "Perguntas à IA com resposta em português"
            ].map((item) => (
              <div key={item} className="rounded-3xl bg-slate-50 p-5 text-sm text-slate-600">
                {item}
              </div>
            ))}
          </div>
        </Card>
      </div>
    </main>
  );
}
