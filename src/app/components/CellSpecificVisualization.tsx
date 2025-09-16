'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell
} from 'recharts';

interface CellSpecificVisualizationProps {
  results: Array<{
    p1_name: string;
    p2_name: string;
    cell_correlations?: Array<{
      cell_type: string;
      pearson_corr: number;
      cosine_sim: number;
      jaccard_index: number;
      l2_norm_diff: number;
      overlap_count: number;
    }>;
  }>;
  analysisMode: string;
}

export default function CellSpecificVisualization({
  results,
  analysisMode
}: CellSpecificVisualizationProps) {
  const [selectedCells, setSelectedCells] = useState<string[]>([]);
  const [metricType, setMetricType] = useState<'pearson_corr' | 'cosine_sim' | 'jaccard_index' | 'l2_norm_diff'>('pearson_corr');
  const [selectedTissueForCells, setSelectedTissueForCells] = useState<string | null>(null);
  const [tissueExpressionData, setTissueExpressionData] = useState<any[]>([]);
  const [allCellData, setAllCellData] = useState<any>({});
  const [loadingTissueData, setLoadingTissueData] = useState(false);
  const [loadingAllData, setLoadingAllData] = useState(false);

  // Cell colors for visualization - using a hash function for consistent colors
  const getColorForCell = (cellType: string) => {
    const colors = [
      '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4',
      '#EC4899', '#84CC16', '#F97316', '#6366F1', '#F43F5E', '#14B8A6',
      '#F59E0B', '#8B5CF6', '#06B6D4', '#EC4899', '#84CC16', '#F97316',
      '#3B82F6', '#10B981', '#EF4444', '#6366F1', '#F43F5E', '#14B8A6'
    ];
    let hash = 0;
    for (let i = 0; i < cellType.length; i++) {
      hash = ((hash << 5) - hash + cellType.charCodeAt(i)) & 0xffffffff;
    }
    return colors[Math.abs(hash) % colors.length];
  };

  // Get available cell types from results
  const availableItems = useMemo(() => {
    if (!results.length) return [];
    const result = results[0];
    if (result.cell_correlations) {
      return [...new Set(result.cell_correlations.map(c => c.cell_type))].sort();
    }
    return [];
  }, [results]);

  // Auto-clear selections when data changes
  useEffect(() => {
    if (availableItems.length > 0) {
      setSelectedCells([]);
    }
  }, [availableItems]);

  // Process data for visualization
  const visualizationData = useMemo(() => {
    if (!results.length) return [];
    const result = results[0];
    let cellData = result.cell_correlations || [];

    // Filter by selected cells if any are selected
    if (selectedCells.length > 0) {
      cellData = cellData.filter(c => selectedCells.includes(c.cell_type));
    }

    // Sort by absolute value of the selected metric (highest to lowest)
    return cellData
      .map(c => ({
        name: c.cell_type,
        pearson_corr: c.pearson_corr,
        cosine_sim: c.cosine_sim,
        jaccard_index: c.jaccard_index,
        l2_norm_diff: c.l2_norm_diff,
        overlap_count: c.overlap_count,
        fill: getColorForCell(c.cell_type)
      }))
      .sort((a, b) => Math.abs(b[metricType]) - Math.abs(a[metricType]));
  }, [results, selectedCells, metricType]);

  // Fetch all cell expression data on load
  const fetchAllCellData = useCallback(async () => {
    if (!results.length) return;

    setLoadingAllData(true);
    try {
      const result = results[0];

      // Make a single bulk API call for all cell types
      const response = await fetch(`/api/all-cell-expression?${new URLSearchParams({
        gene1: result.p1_name,
        gene2: result.p2_name,
        cellTypes: availableItems.join(',')
      })}`);

      if (response.ok) {
        const data = await response.json();
        setAllCellData(data);
      }
    } catch (error) {
      console.error('Error fetching all cell data:', error);
    } finally {
      setLoadingAllData(false);
    }
  }, [results, availableItems]);

  useEffect(() => {
    if (availableItems.length > 0) {
      fetchAllCellData();
    }
  }, [availableItems, fetchAllCellData]);

  const handleItemToggle = (item: string) => {
    setSelectedCells(prev =>
      prev.includes(item)
        ? prev.filter(c => c !== item)
        : [...prev, item]
    );
  };

  // Fetch expression data for a specific cell type
  const fetchCellExpressionData = async (cellType: string) => {
    if (!results.length) {
      console.log('No results available');
      return;
    }

    setLoadingTissueData(true);
    try {
      const result = results[0];

      const response = await fetch(`/api/cell-expression?${new URLSearchParams({
        gene1: result.p1_name,
        gene2: result.p2_name,
        cellType: cellType
      })}`);

      if (!response.ok) {
        throw new Error('Failed to fetch cell expression data');
      }

      const data = await response.json();
      setTissueExpressionData(data);
    } catch (error) {
      console.error('Error fetching cell expression data:', error);
      setTissueExpressionData([]);
    } finally {
      setLoadingTissueData(false);
    }
  };

  const handleCellClick = (cellType: string) => {
    setSelectedTissueForCells(cellType);
    fetchCellExpressionData(cellType);
  };

  return (
    <div className="space-y-3">
      {/* Results Header */}
      <div className="bg-navy-800 rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-white">
            Cell-Specific Correlation Results
          </h2>
          <div className="flex items-center space-x-4">
            <div className="text-white">
              <span className="font-medium">Gene 1:</span> {results[0]?.p1_name}
            </div>
            <div className="text-white">
              <span className="font-medium">Gene 2:</span> {results[0]?.p2_name}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Visualization Controls */}
          <div>
            <h3 className="text-lg font-medium text-white mb-3">Visualization Controls</h3>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Primary Metric
              </label>
              <select
                value={metricType}
                onChange={(e) => setMetricType(e.target.value as any)}
                className="w-full px-3 py-2 rounded bg-white text-black border border-navy-600 focus:outline-none focus:border-navy-400"
              >
                <option value="pearson_corr">Pearson Correlation</option>
                <option value="cosine_sim">Cosine Similarity</option>
                <option value="jaccard_index">Jaccard Index</option>
              </select>
            </div>
          </div>

          {/* Filter Controls */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-medium text-white">
                Filter Cell Types
              </h3>
              <div className="flex space-x-2">
                <button
                  onClick={() => setSelectedCells([])}
                  className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-500"
                >
                  Deselect All
                </button>
                <button
                  onClick={() => setSelectedCells(availableItems)}
                  className="px-3 py-1 text-sm bg-navy-600 text-white rounded hover:bg-navy-500"
                >
                  Select All
                </button>
              </div>
            </div>

            <div className="max-h-40 overflow-y-auto space-y-1">
              {availableItems.map(item => (
                <label key={item} className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedCells.includes(item)}
                    onChange={() => handleItemToggle(item)}
                    className="rounded border-navy-300 text-navy-600 focus:ring-navy-500"
                  />
                  <span className="text-white text-sm">
                    {item.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Loading indicator for expression plots */}
      {loadingAllData && (
        <div className="bg-white rounded-lg p-8 text-center">
          <div className="text-gray-500">Loading expression data...</div>
        </div>
      )}

      {/* Expression Plots */}
      {Object.keys(allCellData).length > 0 && !loadingAllData && (
        <div className="space-y-3">
          {/* Gene 1 Expression Plot */}
          <div className="bg-white rounded-lg p-4">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              {results[0]?.p1_name} Expression Across {selectedCells.length === 0 ? 'Cell Types' : 'Tissues'} (nTPM)
            </h3>
            {loadingAllData ? (
              <div className="text-center text-gray-500 py-8">Loading expression data...</div>
            ) : (
              <div className="h-[350px] relative">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={(() => {
                      if (selectedCells.length === 0) {
                        // Show all tissue data grouped by cell type, filter out cells with 0 expression for both genes
                        return Object.keys(allCellData).sort().flatMap((cellType, cellIdx) =>
                          allCellData[cellType]
                            .filter((tissue: any) => tissue.gene1_expression > 0 || tissue.gene2_expression > 0)
                            .map((tissue: any, tissueIndex: number) => {
                              const cellFormatted = cellType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                              return {
                                tissueType: tissue.tissueType || tissue.tissue,
                                cellType: cellType,
                                gene1_name: tissue.gene1_name,
                                gene1_expression: tissue.gene1_expression,
                                gene2_name: tissue.gene2_name,
                                gene2_expression: tissue.gene2_expression,
                                cellGroup: cellFormatted,
                                cellRaw: cellType,
                                cellIndex: cellIdx,
                                tissueIndex: tissueIndex,
                                displayName: tissue.tissueType || tissue.tissue,
                                fullTissueType: tissue.tissueType || tissue.tissue,
                                barColor: getColorForCell(cellType)
                              };
                            })
                        );
                      } else {
                        // Show detailed tissue data for selected cell types only
                        const filteredCells = Object.keys(allCellData).sort().filter(cellType => selectedCells.includes(cellType));
                        return filteredCells.flatMap((cellType, cellIdx) =>
                          allCellData[cellType]
                            .filter((tissue: any) => tissue.gene1_expression > 0 || tissue.gene2_expression > 0)
                            .map((tissue: any, tissueIndex: number) => {
                              const cellFormatted = cellType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                              return {
                                tissueType: tissue.tissueType || tissue.tissue,
                                cellType: cellType,
                                gene1_name: tissue.gene1_name,
                                gene1_expression: tissue.gene1_expression,
                                gene2_name: tissue.gene2_name,
                                gene2_expression: tissue.gene2_expression,
                                cellGroup: cellFormatted,
                                cellRaw: cellType,
                                cellIndex: cellIdx,
                                tissueIndex: tissueIndex,
                                displayName: tissue.tissueType || tissue.tissue,
                                fullTissueType: tissue.tissueType || tissue.tissue,
                                barColor: getColorForCell(cellType)
                              };
                            })
                        );
                      }
                    })()}
                    margin={{ top: 10, right: 20, left: 40, bottom: 60 }}
                    barCategoryGap="10%"
                    maxBarSize={40}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                    <XAxis
                      dataKey={selectedCells.length === 0 ? "cellGroup" : "tissueType"}
                      tick={{ fill: '#374151', fontSize: 10 }}
                      angle={-45}
                      textAnchor="end"
                      height={60}
                      tickSize={1}
                      interval={0}
                      tickFormatter={(value, index) => {
                        if (selectedCells.length === 0) {
                          // For cell type view, only show label in the middle of each cell group
                          const data = (() => {
                            if (selectedCells.length === 0) {
                              return Object.keys(allCellData).sort().flatMap((cellType, cellIdx) =>
                                allCellData[cellType]
                                  .filter((tissue: any) => tissue.gene1_expression > 0 || tissue.gene2_expression > 0)
                                  .map((tissue: any, tissueIndex: number) => {
                                    const cellFormatted = cellType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                                    return { cellGroup: cellFormatted };
                                  })
                              );
                            }
                            return [];
                          })();

                          const cellGroups: any = {};
                          data.forEach((item: any, idx: number) => {
                            if (!cellGroups[item.cellGroup]) {
                              cellGroups[item.cellGroup] = [];
                            }
                            cellGroups[item.cellGroup].push(idx);
                          });

                          const cellMiddleIndices = Object.values(cellGroups).map((indices: any) =>
                            Math.floor((indices[0] + indices[indices.length - 1]) / 2)
                          );

                          return cellMiddleIndices.includes(index) ? value : '';
                        }
                        return value;
                      }}
                    />
                    <YAxis
                      tick={{ fill: '#374151', fontSize: 10 }}
                      label={{ value: 'nTPM', angle: -90, position: 'insideLeft' }}
                    />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="bg-white p-3 rounded border border-gray-200 shadow-lg">
                              <p className="text-gray-900 font-medium">{data.cellGroup}</p>
                              <p className="text-gray-700 text-sm">{data.fullTissueType}</p>
                              <p className="text-blue-600">
                                {data.gene1_name}: {Number(payload[0].value).toFixed(2)} nTPM
                              </p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Bar
                      dataKey="gene1_expression"
                      radius={[2, 2, 0, 0]}
                    >
                      {(() => {
                        if (selectedCells.length === 0) {
                          // Color by cell type for all tissue data
                          return Object.keys(allCellData).sort().flatMap((cellType, cellIdx) =>
                            allCellData[cellType]
                              .filter((tissue: any) => tissue.gene1_expression > 0 || tissue.gene2_expression > 0)
                              .map((tissue: any, tissueIndex: number) => (
                                <Cell key={`cell-${cellIdx}-${tissueIndex}`} fill={getColorForCell(cellType)} />
                              ))
                          );
                        } else {
                          // Color by cell type for selected cell types' tissue data
                          const filteredCells = Object.keys(allCellData).sort().filter(cellType => selectedCells.includes(cellType));
                          return filteredCells.flatMap((cellType, cellIdx) =>
                            allCellData[cellType]
                              .filter((tissue: any) => tissue.gene1_expression > 0 || tissue.gene2_expression > 0)
                              .map((tissue: any, tissueIndex: number) => (
                                <Cell key={`cell-${cellIdx}-${tissueIndex}`} fill={getColorForCell(cellType)} />
                              ))
                          );
                        }
                      })()}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Gene 2 Expression Plot */}
          <div className="bg-white rounded-lg p-4">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              {results[0]?.p2_name} Expression Across {selectedCells.length === 0 ? 'Cell Types' : 'Tissues'} (nTPM)
            </h3>
            {loadingAllData ? (
              <div className="text-center text-gray-500 py-8">Loading expression data...</div>
            ) : (
              <div className="h-[350px] relative">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={(() => {
                      if (selectedCells.length === 0) {
                        // Show all tissue data grouped by cell type, filter out cells with 0 expression for both genes
                        return Object.keys(allCellData).sort().flatMap((cellType, cellIdx) =>
                          allCellData[cellType]
                            .filter((tissue: any) => tissue.gene1_expression > 0 || tissue.gene2_expression > 0)
                            .map((tissue: any, tissueIndex: number) => {
                              const cellFormatted = cellType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                              return {
                                tissueType: tissue.tissueType || tissue.tissue,
                                cellType: cellType,
                                gene1_name: tissue.gene1_name,
                                gene1_expression: tissue.gene1_expression,
                                gene2_name: tissue.gene2_name,
                                gene2_expression: tissue.gene2_expression,
                                cellGroup: cellFormatted,
                                cellRaw: cellType,
                                cellIndex: cellIdx,
                                tissueIndex: tissueIndex,
                                displayName: tissue.tissueType || tissue.tissue,
                                fullTissueType: tissue.tissueType || tissue.tissue,
                                barColor: getColorForCell(cellType)
                              };
                            })
                        );
                      } else {
                        // Show detailed tissue data for selected cell types only
                        const filteredCells = Object.keys(allCellData).sort().filter(cellType => selectedCells.includes(cellType));
                        return filteredCells.flatMap((cellType, cellIdx) =>
                          allCellData[cellType]
                            .filter((tissue: any) => tissue.gene1_expression > 0 || tissue.gene2_expression > 0)
                            .map((tissue: any, tissueIndex: number) => {
                              const cellFormatted = cellType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                              return {
                                tissueType: tissue.tissueType || tissue.tissue,
                                cellType: cellType,
                                gene1_name: tissue.gene1_name,
                                gene1_expression: tissue.gene1_expression,
                                gene2_name: tissue.gene2_name,
                                gene2_expression: tissue.gene2_expression,
                                cellGroup: cellFormatted,
                                cellRaw: cellType,
                                cellIndex: cellIdx,
                                tissueIndex: tissueIndex,
                                displayName: tissue.tissueType || tissue.tissue,
                                fullTissueType: tissue.tissueType || tissue.tissue,
                                barColor: getColorForCell(cellType)
                              };
                            })
                        );
                      }
                    })()}
                    margin={{ top: 10, right: 20, left: 40, bottom: 60 }}
                    barCategoryGap="10%"
                    maxBarSize={40}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                    <XAxis
                      dataKey={selectedCells.length === 0 ? "cellGroup" : "tissueType"}
                      tick={{ fill: '#374151', fontSize: 10 }}
                      angle={-45}
                      textAnchor="end"
                      height={60}
                      tickSize={1}
                      interval={0}
                      tickFormatter={(value, index) => {
                        if (selectedCells.length === 0) {
                          // For cell type view, only show label in the middle of each cell group
                          const data = (() => {
                            if (selectedCells.length === 0) {
                              return Object.keys(allCellData).sort().flatMap((cellType, cellIdx) =>
                                allCellData[cellType]
                                  .filter((tissue: any) => tissue.gene1_expression > 0 || tissue.gene2_expression > 0)
                                  .map((tissue: any, tissueIndex: number) => {
                                    const cellFormatted = cellType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                                    return { cellGroup: cellFormatted };
                                  })
                              );
                            }
                            return [];
                          })();

                          const cellGroups: any = {};
                          data.forEach((item: any, idx: number) => {
                            if (!cellGroups[item.cellGroup]) {
                              cellGroups[item.cellGroup] = [];
                            }
                            cellGroups[item.cellGroup].push(idx);
                          });

                          const cellMiddleIndices = Object.values(cellGroups).map((indices: any) =>
                            Math.floor((indices[0] + indices[indices.length - 1]) / 2)
                          );

                          return cellMiddleIndices.includes(index) ? value : '';
                        }
                        return value;
                      }}
                    />
                    <YAxis
                      tick={{ fill: '#374151', fontSize: 10 }}
                      label={{ value: 'nTPM', angle: -90, position: 'insideLeft' }}
                    />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="bg-white p-3 rounded border border-gray-200 shadow-lg">
                              <p className="text-gray-900 font-medium">{data.cellGroup}</p>
                              <p className="text-gray-700 text-sm">{data.fullTissueType}</p>
                              <p className="text-emerald-600">
                                {data.gene2_name}: {Number(payload[0].value).toFixed(2)} nTPM
                              </p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Bar
                      dataKey="gene2_expression"
                      radius={[2, 2, 0, 0]}
                    >
                      {(() => {
                        if (selectedCells.length === 0) {
                          // Color by cell type for all tissue data
                          return Object.keys(allCellData).sort().flatMap((cellType, cellIdx) =>
                            allCellData[cellType]
                              .filter((tissue: any) => tissue.gene1_expression > 0 || tissue.gene2_expression > 0)
                              .map((tissue: any, tissueIndex: number) => (
                                <Cell key={`cell-${cellIdx}-${tissueIndex}`} fill={getColorForCell(cellType)} />
                              ))
                          );
                        } else {
                          // Color by cell type for selected cell types' tissue data
                          const filteredCells = Object.keys(allCellData).sort().filter(cellType => selectedCells.includes(cellType));
                          return filteredCells.flatMap((cellType, cellIdx) =>
                            allCellData[cellType]
                              .filter((tissue: any) => tissue.gene1_expression > 0 || tissue.gene2_expression > 0)
                              .map((tissue: any, tissueIndex: number) => (
                                <Cell key={`cell-${cellIdx}-${tissueIndex}`} fill={getColorForCell(cellType)} />
                              ))
                          );
                        }
                      })()}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Correlation Analysis */}
      <div className="bg-white rounded-lg p-4">
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          Cell Type Correlation Analysis
        </h3>
        {visualizationData.length > 0 ? (
          <div className="h-96">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={visualizationData} margin={{ top: 20, right: 30, left: 20, bottom: 80 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis
                  dataKey="name"
                  tick={{ fill: '#374151', fontSize: 10 }}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                  tickFormatter={(value) => value.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                />
                <YAxis
                  tick={{ fill: '#374151', fontSize: 10 }}
                  domain={metricType === 'l2_norm_diff' ? ['dataMin', 'dataMax'] : [-1, 1]}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-white p-3 rounded border border-gray-200 shadow-lg">
                          <p className="font-medium text-gray-900">
                            {data.name.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                          </p>
                          <p className={`text-sm ${metricType === 'l2_norm_diff'
                            ? (data[metricType] < 0.5 ? 'text-green-600' : 'text-red-600')
                            : (data[metricType] > 0 ? 'text-green-600' : 'text-red-600')
                          }`}>
                            {metricType === 'pearson_corr' && 'Pearson Correlation: '}
                            {metricType === 'cosine_sim' && 'Cosine Similarity: '}
                            {metricType === 'jaccard_index' && 'Jaccard Index: '}
                            {Number(data[metricType]).toFixed(3)}
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar
                  dataKey={metricType}
                  onClick={(data) => handleCellClick(data.name)}
                  style={{ cursor: 'pointer' }}
                >
                  {visualizationData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="text-center text-gray-500 py-8">
            No cell types selected for visualization. Click on &quot;Select All&quot; to show all cell types.
          </div>
        )}
      </div>

      {/* Tissue-Specific Expression Plots for Selected Cell Type */}
      {selectedTissueForCells && (
        <div className="space-y-3">
          {/* Header */}
          <div className="bg-navy-800 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-white">
                Tissue-Specific Expression in {selectedTissueForCells.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())} Cells
              </h3>
              <button
                onClick={() => setSelectedTissueForCells(null)}
                className="px-3 py-1 text-sm bg-navy-600 text-white rounded hover:bg-navy-500"
              >
                Close
              </button>
            </div>
            {loadingTissueData && (
              <div className="text-gray-300 text-sm mt-2">Loading tissue expression data...</div>
            )}
          </div>

          {/* Expression Plots */}
          {tissueExpressionData.length > 0 && (
            <div className="space-y-3">
              {/* Gene 1 Expression Plot */}
              <div className="bg-white rounded-lg p-4">
                <h4 className="text-lg font-medium text-gray-900 mb-4">
                  {tissueExpressionData[0]?.gene1_name} Expression (nTPM)
                </h4>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={tissueExpressionData}
                      margin={{ top: 20, right: 30, left: 20, bottom: 80 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                      <XAxis
                        dataKey="tissueType"
                        tick={{ fill: '#374151', fontSize: 8 }}
                        angle={-45}
                        textAnchor="end"
                        height={80}
                      />
                      <YAxis
                        tick={{ fill: '#374151', fontSize: 10 }}
                        label={{ value: 'nTPM', angle: -90, position: 'insideLeft' }}
                      />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            return (
                              <div className="bg-white p-3 rounded border border-gray-200 shadow-lg">
                                <p className="font-medium text-gray-900">{data.tissueType}</p>
                                <p className="text-blue-600">
                                  {data.gene1_name}: {Number(payload[0].value).toFixed(2)} nTPM
                                </p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Bar
                        dataKey="gene1_expression"
                        fill="#60A5FA"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Gene 2 Expression Plot */}
              <div className="bg-white rounded-lg p-4">
                <h4 className="text-lg font-medium text-gray-900 mb-4">
                  {tissueExpressionData[0]?.gene2_name} Expression (nTPM)
                </h4>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={tissueExpressionData}
                      margin={{ top: 20, right: 30, left: 20, bottom: 80 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                      <XAxis
                        dataKey="tissueType"
                        tick={{ fill: '#374151', fontSize: 8 }}
                        angle={-45}
                        textAnchor="end"
                        height={80}
                      />
                      <YAxis
                        tick={{ fill: '#374151', fontSize: 10 }}
                        label={{ value: 'nTPM', angle: -90, position: 'insideLeft' }}
                      />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            return (
                              <div className="bg-white p-3 rounded border border-gray-200 shadow-lg">
                                <p className="font-medium text-gray-900">{data.tissueType}</p>
                                <p className="text-emerald-600">
                                  {data.gene2_name}: {Number(payload[0].value).toFixed(2)} nTPM
                                </p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Bar
                        dataKey="gene2_expression"
                        fill="#34D399"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          {/* No data message */}
          {!loadingTissueData && tissueExpressionData.length === 0 && (
            <div className="bg-white rounded-lg p-4 text-center text-gray-500">
              No expression data available for {selectedTissueForCells}
            </div>
          )}
        </div>
      )}
    </div>
  );
}