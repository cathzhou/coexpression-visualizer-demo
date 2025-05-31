'use client';

import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { SearchResult } from '@/types';

export default function SearchForm() {
  const [searchMode, setSearchMode] = useState<'all' | 'compare'>('all');
  const [query, setQuery] = useState('');
  const [secondQuery, setSecondQuery] = useState('');
  const [queryType, setQueryType] = useState<'receptor' | 'ligand'>('receptor');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentGene, setCurrentGene] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResults([]);
    setCurrentGene(null);

    try {
      const eventSource = new EventSource(`/api/search?${new URLSearchParams({
        query,
        secondQuery: searchMode === 'compare' ? secondQuery : '',
        queryType,
        searchMode
      })}`);

      eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.currentGene) {
          setCurrentGene(data.currentGene);
        } else if (data.results) {
          setResults(data.results);
          eventSource.close();
          setLoading(false);
        }
      };

      eventSource.onerror = (error) => {
        console.error('EventSource error:', error);
        eventSource.close();
        setError('An error occurred while processing the data');
        setLoading(false);
      };
    } catch (error) {
      setError(error instanceof Error ? error.message : 'An error occurred');
      setLoading(false);
    }
  };

  // Clean up EventSource on unmount
  useEffect(() => {
    return () => {
      const eventSource = new EventSource('/api/search');
      eventSource.close();
    };
  }, []);

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-4">
          {/* Search Mode Selection */}
          <div className="flex space-x-4 justify-center">
            <button
              type="button"
              onClick={() => setSearchMode('all')}
              className={`px-4 py-2 rounded ${
                searchMode === 'all'
                  ? 'bg-navy-600 text-white'
                  : 'bg-navy-800 text-gray-300 hover:bg-navy-700'
              }`}
            >
              Search All Pairs
            </button>
            <button
              type="button"
              onClick={() => setSearchMode('compare')}
              className={`px-4 py-2 rounded ${
                searchMode === 'compare'
                  ? 'bg-navy-600 text-white'
                  : 'bg-navy-800 text-gray-300 hover:bg-navy-700'
              }`}
            >
              Direct Compare
            </button>
          </div>

          {/* Query Type Selection (hidden for compare mode) */}
          {searchMode !== 'compare' && (
            <div className="flex justify-center space-x-4">
              <button
                type="button"
                onClick={() => setQueryType('receptor')}
                className={`px-4 py-2 rounded ${
                  queryType === 'receptor'
                    ? 'bg-navy-600 text-white'
                    : 'bg-navy-800 text-gray-300 hover:bg-navy-700'
                }`}
              >
                Search Against Ligands
              </button>
              <button
                type="button"
                onClick={() => setQueryType('ligand')}
                className={`px-4 py-2 rounded ${
                  queryType === 'ligand'
                    ? 'bg-navy-600 text-white'
                    : 'bg-navy-800 text-gray-300 hover:bg-navy-700'
                }`}
              >
                Search Against Receptors
              </button>
            </div>
          )}

          {/* Search Instructions */}
          <div className="text-center text-gray-300 text-sm">
            {searchMode === 'compare' ? (
              <p>Enter comma-separated lists of genes (e.g., "AGTR2, BKRB2" and "CCL16, DFB4A")</p>
            ) : (
              <p>Enter a gene name or UniProt ID to search all possible pairs</p>
            )}
          </div>

          {/* Search Inputs */}
          <div className="flex justify-center space-x-4">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchMode === 'compare' ? "Enter receptors (comma-separated)" : "Enter search term"}
              className="px-4 py-2 rounded bg-navy-800 text-white border border-navy-600 focus:outline-none focus:border-navy-400 w-64"
            />
            {searchMode === 'compare' && (
              <input
                type="text"
                value={secondQuery}
                onChange={(e) => setSecondQuery(e.target.value)}
                placeholder="Enter ligands (comma-separated)"
                className="px-4 py-2 rounded bg-navy-800 text-white border border-navy-600 focus:outline-none focus:border-navy-400 w-64"
              />
            )}
            <button
              type="submit"
              disabled={loading || (!query || (searchMode === 'compare' && !secondQuery))}
              className="px-6 py-2 bg-navy-600 text-white rounded hover:bg-navy-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Searching...' : 'Search'}
            </button>
          </div>
        </div>
      </form>

      {/* Loading and Processing Status */}
      {loading && (
        <div className="text-center space-y-2">
          <div className="text-white">Processing expression data...</div>
          {currentGene && (
            <div className="text-gray-300">
              Currently processing: {currentGene}
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="text-red-500 text-center">
          {error}
        </div>
      )}

      {/* Results Display */}
      {results.length > 0 && (
        <div className="space-y-6">
          {results.map((result, index) => (
            <div key={index} className="border border-navy-600 rounded p-4 bg-navy-800">
              <div className="mb-4">
                <h3 className="text-xl font-semibold text-white mb-2">
                  {result.pair.p1_name} ({result.pair.p1_id}) - {result.pair.p2_name} ({result.pair.p2_id})
                </h3>
                <div className="text-gray-300">
                  <h4 className="font-medium mb-2">Correlation Metrics:</h4>
                  <ul className="space-y-1">
                    <li>Pearson Correlation: {result.features?.pearson_corr?.toFixed(3) ?? 'N/A'}</li>
                    <li>Cosine Similarity: {result.features?.cosine_sim?.toFixed(3) ?? 'N/A'}</li>
                    <li>Jaccard Index: {result.features?.jaccard_index?.toFixed(3) ?? 'N/A'}</li>
                  </ul>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium mb-2 text-gray-300">
                    {searchMode === 'compare' ? 'Receptor' : queryType === 'receptor' ? 'Receptor' : 'Ligand'} Expression:
                  </h4>
                  <img
                    src={result.plots.receptor}
                    alt={`Expression profile for ${result.pair.p1_name}`}
                    className="w-full rounded border border-navy-600"
                  />
                </div>
                <div>
                  <h4 className="font-medium mb-2 text-gray-300">
                    {searchMode === 'compare' ? 'Ligand' : queryType === 'receptor' ? 'Ligand' : 'Receptor'} Expression:
                  </h4>
                  <img
                    src={result.plots.ligand}
                    alt={`Expression profile for ${result.pair.p2_name}`}
                    className="w-full rounded border border-navy-600"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
} 