'use client';

import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { SearchResult, TissueSpecificResult } from '@/types';
import ExpressionPlot from './ExpressionPlot';

const AVAILABLE_TISSUES = [
  'adipose tissue', 'bone marrow', 'brain', 'breast', 'bronchus', 'colon',
  'endometrium', 'esophagus', 'eye', 'fallopian tube', 'heart muscle', 'kidney',
  'liver', 'lung', 'lymph node', 'ovary', 'pancreas', 'pbmc', 'placenta',
  'prostate', 'rectum', 'salivary gland', 'skeletal muscle', 'skin',
  'small intestine', 'spleen', 'stomach', 'testis', 'thymus', 'tongue', 'vascular'
];

export default function SearchForm() {
  const [searchMode, setSearchMode] = useState<'all' | 'compare' | 'tissue-specific'>('all');
  const [query, setQuery] = useState('');
  const [secondQuery, setSecondQuery] = useState('');
  const [queryType, setQueryType] = useState<'receptor' | 'ligand'>('receptor');
  const [selectedTissue, setSelectedTissue] = useState<string>('brain');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [tissueResults, setTissueResults] = useState<TissueSpecificResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentGene, setCurrentGene] = useState<string | null>(null);
  const [processedCount, setProcessedCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [errors, setErrors] = useState<string[]>([]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setErrors([]);
    setResults([]);
    setTissueResults([]);
    setCurrentGene(null);
    setProcessedCount(0);
    setCurrentPage(1);
    setHasMore(true);
    
    if (searchMode === 'tissue-specific') {
      await fetchTissueSpecificResults(1, true);
    } else {
      await fetchResults(1, true);
    }
  };

  const fetchResults = async (page: number, isNewSearch: boolean = false) => {
    try {
      if (isNewSearch) {
        setProcessedCount(0);
        setErrors([]);
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
          if (data.errors) {
            setErrors(prev => [...prev, ...data.errors]);
          }
          eventSource.close();
          setLoading(false);
          setProcessedCount(0);
        } else if (data.error) {
          setError(data.error);
          if (data.details) {
            setErrors(prev => [...prev, data.details]);
          }
          eventSource.close();
          setLoading(false);
          setProcessedCount(0);
        }
      };

      eventSource.onerror = (error) => {
        console.error('EventSource error:', error);
        eventSource.close();
        
        // Try to get the response error message
        const errorResponse = error instanceof Error ? error.message : 'Connection error';
        setError(errorResponse);
        setErrors(prev => [...prev, `Failed to connect to server: ${errorResponse}`]);
        setLoading(false);
        setProcessedCount(0);
      };
    } catch (error) {
      setError(error instanceof Error ? error.message : 'An error occurred');
      setLoading(false);
      setProcessedCount(0);
    }
  };

  const fetchTissueSpecificResults = async (page: number, isNewSearch: boolean = false) => {
    try {
      if (isNewSearch) {
        setProcessedCount(0);
        setErrors([]);
      }

      const eventSource = new EventSource(`/api/search?${new URLSearchParams({
        query,
        secondQuery: searchMode === 'compare' ? secondQuery : '',
        queryType,
        searchMode,
        selectedTissue,
        page: page.toString()
      })}`);

      eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.currentGene) {
          setCurrentGene(data.currentGene);
          setProcessedCount(prev => prev + 1);
        } else if (data.tissueResults) {
          setTissueResults(prev => isNewSearch ? data.tissueResults : [...prev, ...data.tissueResults]);
          setHasMore(data.hasMore);
          setCurrentPage(data.currentPage);
          if (data.errors) {
            setErrors(prev => [...prev, ...data.errors]);
          }
          eventSource.close();
          setLoading(false);
          setProcessedCount(0);
        } else if (data.error) {
          setError(data.error);
          if (data.details) {
            setErrors(prev => [...prev, data.details]);
          }
          eventSource.close();
          setLoading(false);
          setProcessedCount(0);
        }
      };

      eventSource.onerror = (error) => {
        console.error('EventSource error:', error);
        eventSource.close();
        
        const errorResponse = error instanceof Error ? error.message : 'Connection error';
        setError(errorResponse);
        setErrors(prev => [...prev, `Failed to connect to server: ${errorResponse}`]);
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
      if (searchMode === 'tissue-specific') {
        fetchTissueSpecificResults(currentPage + 1);
      } else {
        fetchResults(currentPage + 1);
      }
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
            <button
              type="button"
              onClick={() => setSearchMode('tissue-specific')}
              className={`px-4 py-2 rounded ${
                searchMode === 'tissue-specific'
                  ? 'bg-navy-600 text-white'
                  : 'bg-navy-800 text-gray-300 hover:bg-navy-700'
              }`}
            >
              Tissue-Specific
            </button>
          </div>

          {/* Tissue Selection (only for tissue-specific mode) */}
          {searchMode === 'tissue-specific' && (
            <div className="flex justify-center">
              <div className="flex items-center space-x-2">
                <label htmlFor="tissue-select" className="text-gray-300">
                  Select Tissue:
                </label>
                <select
                  id="tissue-select"
                  value={selectedTissue}
                  onChange={(e) => setSelectedTissue(e.target.value)}
                  className="px-3 py-2 rounded bg-navy-800 text-white border border-navy-600 focus:outline-none focus:border-navy-400"
                >
                  {AVAILABLE_TISSUES.map(tissue => (
                    <option key={tissue} value={tissue}>
                      {tissue.charAt(0).toUpperCase() + tissue.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Query Type Selection (hidden for compare and tissue-specific modes) */}
          {searchMode !== 'compare' && searchMode !== 'tissue-specific' && (
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
            ) : searchMode === 'tissue-specific' ? (
              <p>Enter gene names or UniProt IDs to find tissue-specific coexpression in {selectedTissue}</p>
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
              placeholder={
                searchMode === 'compare' 
                  ? "Enter receptors (comma-separated)" 
                  : searchMode === 'tissue-specific'
                  ? "Enter genes (comma-separated)"
                  : "Enter search term"
              }
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
            {searchMode === 'tissue-specific' && (
              <input
                type="text"
                value={secondQuery}
                onChange={(e) => setSecondQuery(e.target.value)}
                placeholder="Enter second set of genes (optional)"
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

      {/* Error Display */}
      {error && (
        <div className="text-red-500 text-center space-y-2">
          <div className="font-medium">{error}</div>
          {errors.length > 0 && (
            <div className="text-sm space-y-1">
              {errors.map((err, index) => (
                <div key={index} className="text-red-400">
                  {err}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Results Display */}
      {results.length > 0 && (
        <div className="space-y-6">
          {/* Load More Button - Moved to top */}
          {hasMore && (
            <div className="text-center mb-6">
              <button
                onClick={loadMore}
                disabled={loading}
                className="px-6 py-2 bg-navy-600 text-white rounded hover:bg-navy-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Loading...' : 'Load More Results'}
              </button>
            </div>
          )}

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
        </div>
      )}

      {/* Tissue-Specific Results Display */}
      {tissueResults.length > 0 && (
        <div className="space-y-6">
          {/* Load More Button - Moved to top */}
          {hasMore && (
            <div className="text-center mb-6">
              <button
                onClick={loadMore}
                disabled={loading}
                className="px-6 py-2 bg-navy-600 text-white rounded hover:bg-navy-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Loading...' : 'Load More Results'}
              </button>
            </div>
          )}

          <div className="text-white text-xl font-semibold mb-4">
            Tissue-Specific Coexpression Results for {selectedTissue.charAt(0).toUpperCase() + selectedTissue.slice(1)}
          </div>

          {tissueResults.map((result, index) => (
            <div key={index} className="border border-navy-600 rounded p-4 bg-navy-800">
              <div className="mb-6">
                <h3 className="text-xl font-semibold text-white mb-2">
                  {/* Gene 1 info */}
                  <span className="inline-block">
                    <span className="text-blue-400">{result.p1_name}</span>
                    <span className="text-gray-400 text-base ml-2">
                      (UniProt: {result.p1_uniprot})
                    </span>
                  </span>
                  {/* Separator */}
                  <span className="mx-3 text-gray-400">⟷</span>
                  {/* Gene 2 info */}
                  <span className="inline-block">
                    <span className="text-emerald-400">{result.p2_name}</span>
                    <span className="text-gray-400 text-base ml-2">
                      (UniProt: {result.p2_uniprot})
                    </span>
                  </span>
                </h3>
                
                {/* Tissue-Specific Correlation Statistics */}
                <div className="grid grid-cols-1 gap-4 text-gray-300">
                  <div className="p-4 border border-navy-600 rounded">
                    <h4 className="font-medium mb-2">{selectedTissue.charAt(0).toUpperCase() + selectedTissue.slice(1)} Correlation:</h4>
                    {result.tissue_features[selectedTissue] ? (
                      <ul className="space-y-1">
                        <li>Pearson: {result.tissue_features[selectedTissue].pearson_corr?.toFixed(3) ?? 'N/A'}</li>
                        <li>Cosine: {result.tissue_features[selectedTissue].cosine_sim?.toFixed(3) ?? 'N/A'}</li>
                        <li>Jaccard: {result.tissue_features[selectedTissue].jaccard_index?.toFixed(3) ?? 'N/A'}</li>
                        <li>L2 Norm Diff: {result.tissue_features[selectedTissue].l2_norm_diff?.toFixed(3) ?? 'N/A'}</li>
                        <li>Overlap Count: {result.tissue_features[selectedTissue].overlap_count ?? 'N/A'}</li>
                      </ul>
                    ) : (
                      <p>No data available for {selectedTissue}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
} 