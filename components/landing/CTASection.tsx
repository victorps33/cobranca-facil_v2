export function CTASection({ demoUrl }: { demoUrl: string }) {
  return (
    <section className="bg-menlo-offwhite py-16 md:py-24 px-6">
      <div className="max-w-2xl mx-auto text-center">
        <h2 className="text-2xl md:text-3xl font-bold text-menlo-black mb-3">
          Pronto pra recuperar receita?
        </h2>
        <p className="text-gray-500 mb-8">
          Agende uma demo e veja como a Menlo funciona pro seu negócio
        </p>
        <a
          href={demoUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block bg-menlo-orange text-white px-8 py-3.5 rounded-xl font-semibold text-sm hover:bg-menlo-orange-dark transition-colors"
        >
          Agendar Demo Gratuita
        </a>
      </div>
    </section>
  );
}
