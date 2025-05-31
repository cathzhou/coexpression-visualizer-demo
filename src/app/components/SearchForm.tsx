'use client';

import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { SearchResult } from '@/types';
import ExpressionPlot from './ExpressionPlot';

export default function SearchForm() {
  const [searchMode, setSearchMode] = useState<'all' | 'compare'>('all');
  const [query, setQuery] = useState('');
  const [secondQuery, setSecondQuery] = useState('');
  const [queryType, setQueryType] = useState<'receptor' | 'ligand'>('receptor');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentGene, setCurrentGene] = useState<string | null>(null);
  const [processedCount, setProcessedCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResults([]);
    setCurrentGene(null);
    setProcessedCount(0);
    setCurrentPage(1);
    setHasMore(true);
    
    await fetchResults(1, true);
  };

  const fetchResults = async (page: number, isNewSearch: boolean = false) => {
    try {
      if (isNewSearch) {
        setProcessedCount(0);
      }

      const eventSource = new EventSource(`/api/search?${new URLSearchParams({
        query,
        secondQuery: searchMode === 'compare' ? secondQuery : '',
        queryType,
        searchMode,
        page: page.toString()
      })}`);

      eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.currentGene) {
          setCurrentGene(data.currentGene);
          setProcessedCount(prev => prev + 1);
        } else if (data.results) {
          setResults(prev => isNewSearch ? data.results : [...prev, ...data.results]);
          setHasMore(data.hasMore);
          setCurrentPage(data.currentPage);
          eventSource.close();
          setLoading(false);
          setProcessedCount(0);
        }
      };

      eventSource.onerror = (error) => {
        console.error('EventSource error:', error);
        eventSource.close();
        setError('An error occurred while processing the data');
        setLoading(false);
        setProcessedCount(0);
      };
    } catch (error) {
      setError(error instanceof Error ? error.message : 'An error occurred');
      setLoading(false);
      setProcessedCount(0);
    }
  };

  const loadMore = () => {
    if (!loading && hasMore) {
      setLoading(true);
      fetchResults(currentPage + 1);
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
              <p>Enter single gene or comma-separated lists of genes (UniProt IDs also accepted)</p>
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
              {loading ? 'Processing...' : 'Search'}
            </button>
          </div>
        </div>
      </form>

      {/* Loading and Processing Status */}
      {loading && (
        <div className="text-center space-y-2">
          <div className="text-white">Processing expression data...</div>
          {currentGene && (
            <>
              <div className="text-gray-300">
                Currently processing: {currentGene}
              </div>
              <div className="text-gray-400 text-sm">
                Processed {processedCount} genes in current batch
              </div>
            </>
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
              <div className="mb-6">
                <h3 className="text-xl font-semibold text-white mb-2">
                  {/* Receptor info */}
                  <span className="inline-block">
                    <span className="text-blue-400">{result.expression.receptor.gene_name}</span>
                    <span className="text-gray-400 text-base ml-2">
                      (UniProt: {result.expression.receptor.uniprot_id})
                    </span>
                  </span>
                  {/* Separator */}
                  <span className="mx-3 text-gray-400">⟷</span>
                  {/* Ligand info */}
                  <span className="inline-block">
                    <span className="text-emerald-400">{result.expression.ligand.gene_name}</span>
                    <span className="text-gray-400 text-base ml-2">
                      (UniProt: {result.expression.ligand.uniprot_id})
                    </span>
                  </span>
                </h3>
                
                {/* Correlation Statistics */}
                <div className="grid grid-cols-3 gap-4 text-gray-300">
                  {/* Combined Stats */}
                  <div className="p-4 border border-navy-600 rounded">
                    <h4 className="font-medium mb-2">Combined Correlation:</h4>
                    <ul className="space-y-1">
                      <li>Pearson: {result.features.combined.pearson_corr?.toFixed(3) ?? 'N/A'}</li>
                      <li>Cosine: {result.features.combined.cosine_sim?.toFixed(3) ?? 'N/A'}</li>
                      <li>Jaccard: {result.features.combined.jaccard_index?.toFixed(3) ?? 'N/A'}</li>
                    </ul>
                  </div>
                  
                  {/* Tissue Stats */}
                  <div className="p-4 border border-navy-600 rounded">
                    <h4 className="font-medium mb-2">Tissue Correlation:</h4>
                    <ul className="space-y-1">
                      <li>Pearson: {result.features.tissue.pearson_corr?.toFixed(3) ?? 'N/A'}</li>
                      <li>Cosine: {result.features.tissue.cosine_sim?.toFixed(3) ?? 'N/A'}</li>
                      <li>Jaccard: {result.features.tissue.jaccard_index?.toFixed(3) ?? 'N/A'}</li>
                    </ul>
                  </div>
                  
                  {/* Cell Stats */}
                  <div className="p-4 border border-navy-600 rounded">
                    <h4 className="font-medium mb-2">Cell Type Correlation:</h4>
                    <ul className="space-y-1">
                      <li>Pearson: {result.features.cell.pearson_corr?.toFixed(3) ?? 'N/A'}</li>
                      <li>Cosine: {result.features.cell.cosine_sim?.toFixed(3) ?? 'N/A'}</li>
                      <li>Jaccard: {result.features.cell.jaccard_index?.toFixed(3) ?? 'N/A'}</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Expression Plots */}
              <ExpressionPlot
                receptor={result.expression.receptor}
                ligand={result.expression.ligand}
              />
            </div>
          ))}
          
          {/* Load More Button */}
          {hasMore && (
            <div className="text-center mt-4">
              <button
                onClick={loadMore}
                disabled={loading}
                className="px-6 py-2 bg-navy-600 text-white rounded hover:bg-navy-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Loading...' : 'Load More Results'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
} 