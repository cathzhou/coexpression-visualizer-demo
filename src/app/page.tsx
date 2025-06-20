'use client';

import SearchForm from '@/app/components/SearchForm';

export default function Home() {
  return (
    <div className="min-h-screen bg-navy-900">
      <div className="max-w-4xl mx-auto py-12 px-4">
        <h1 className="text-4xl font-bold text-center mb-4 text-white">
          Receptor-Ligand Co-expression Visualizer
        </h1>
        <p className="text-gray-300 text-center mb-8 max-w-2xl mx-auto">
          Enter a receptor or ligand name (or UniProt ID) to explore expression profiles and discover co-expression patterns across tissues and cell types.
        </p>
        <SearchForm />
      </div>
    </div>
  );
}