import { NextResponse } from 'next/server';
import clientPromise from '@/utils/mongodb';
import { ExpressionDataExtractor } from '@/utils/expressionDataExtractor';
import type { ExpressionProfile, ReceptorLigandPair, SearchResult, TissueSpecificResult, TissueSpecificFeatures } from '@/types';
import fs from 'fs';
import path from 'path';

const dataExtractor = new ExpressionDataExtractor();
const MAX_PAIRS_PER_REQUEST = 50; // Process up to 50 pairs at once

// Helper function to send SSE message
function sendSSEMessage(data: any) {
  return new Response(
    `data: ${JSON.stringify(data)}\n\n`,
    {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    }
  );
}

// Function to handle tissue-specific search
async function handleTissueSpecificSearch(query: string, secondQuery: string | null, selectedTissue: string, page: number) {
  try {
    // Parse gene lists
    const genes1 = query.split(',').map((g: string) => g.trim()).filter(Boolean);
    const genes2 = secondQuery ? secondQuery.split(',').map((g: string) => g.trim()).filter(Boolean) : [];
    
    // Read tissue-specific CSV data
    const csvPath = '/Users/catherinez/VSC/ml-modeling-deorphanize/data/tissue_specific_coexpression_features.csv';
    const csvData = fs.readFileSync(csvPath, 'utf-8');
    const lines = csvData.trim().split('\n');
    const headers = lines[0].split(',');
    
    // Find tissue column indices
    const tissuePrefix = selectedTissue + '_';
    const pearsonIdx = headers.findIndex(h => h === tissuePrefix + 'pearson_corr');
    const cosineIdx = headers.findIndex(h => h === tissuePrefix + 'cosine_sim');
    const jaccardIdx = headers.findIndex(h => h === tissuePrefix + 'jaccard_index');
    const l2Idx = headers.findIndex(h => h === tissuePrefix + 'l2_norm_diff');
    const overlapIdx = headers.findIndex(h => h === tissuePrefix + 'overlap_count');
    
    if (pearsonIdx === -1) {
      return sendSSEMessage({ error: `Tissue "${selectedTissue}" not found in data` });
    }
    
    // Filter rows based on gene queries
    const results: TissueSpecificResult[] = [];
    
    for (let i = 1; i < lines.length; i++) {
      const row = lines[i].split(',');
      const p1Name = row[0];
      const p1Uniprot = row[1];
      const p1Ensembl = row[2];
      const p2Name = row[3];
      const p2Uniprot = row[4];
      const p2Ensembl = row[5];
      const pairId = row[6];
      
      // Check if this pair matches our query
      const matchesQuery = genes1.some(g => 
        p1Name.toLowerCase().includes(g.toLowerCase()) || 
        p1Uniprot.toLowerCase().includes(g.toLowerCase()) ||
        p2Name.toLowerCase().includes(g.toLowerCase()) || 
        p2Uniprot.toLowerCase().includes(g.toLowerCase())
      );
      
      const matchesSecondQuery = !genes2.length || genes2.some(g => 
        p1Name.toLowerCase().includes(g.toLowerCase()) || 
        p1Uniprot.toLowerCase().includes(g.toLowerCase()) ||
        p2Name.toLowerCase().includes(g.toLowerCase()) || 
        p2Uniprot.toLowerCase().includes(g.toLowerCase())
      );
      
      if (matchesQuery && matchesSecondQuery) {
        const tissueFeatures: Record<string, TissueSpecificFeatures> = {};
        tissueFeatures[selectedTissue] = {
          pearson_corr: parseFloat(row[pearsonIdx]) || 0,
          cosine_sim: parseFloat(row[cosineIdx]) || 0,
          jaccard_index: parseFloat(row[jaccardIdx]) || 0,
          l2_norm_diff: parseFloat(row[l2Idx]) || 0,
          overlap_count: parseInt(row[overlapIdx]) || 0
        };
        
        results.push({
          p1_name: p1Name,
          p1_uniprot: p1Uniprot,
          p1_ensembl: p1Ensembl,
          p2_name: p2Name,
          p2_uniprot: p2Uniprot,
          p2_ensembl: p2Ensembl,
          pair_id: pairId,
          tissue_features: tissueFeatures
        });
      }
    }
    
    // Sort by Pearson correlation descending
    results.sort((a, b) => 
      (b.tissue_features[selectedTissue]?.pearson_corr || 0) - 
      (a.tissue_features[selectedTissue]?.pearson_corr || 0)
    );
    
    // Pagination
    const startIdx = (page - 1) * MAX_PAIRS_PER_REQUEST;
    const paginatedResults = results.slice(startIdx, startIdx + MAX_PAIRS_PER_REQUEST);
    const hasMore = results.length > startIdx + MAX_PAIRS_PER_REQUEST;
    
    return sendSSEMessage({
      tissueResults: paginatedResults,
      hasMore,
      currentPage: page
    });
    
  } catch (error) {
    console.error('Tissue-specific search error:', error);
    return sendSSEMessage({ 
      error: 'Error processing tissue-specific search',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('query');
    const secondQuery = searchParams.get('secondQuery');
    const queryType = searchParams.get('queryType') as 'receptor' | 'ligand';
    const searchMode = searchParams.get('searchMode') as 'all' | 'compare' | 'tissue-specific';
    const selectedTissue = searchParams.get('selectedTissue');
    const page = parseInt(searchParams.get('page') || '1');
    
    if (!query || (!searchMode) || (searchMode === 'compare' && !secondQuery) || (searchMode === 'tissue-specific' && !selectedTissue)) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    // Handle tissue-specific search mode
    if (searchMode === 'tissue-specific') {
      return handleTissueSpecificSearch(query, secondQuery, selectedTissue, page);
    }

    const client = await clientPromise;
    const db = client.db('coexpression_db');
    const pairsCollection = db.collection<ReceptorLigandPair>('receptor_ligand_pairs');
    
    let pairs: ReceptorLigandPair[] = [];

    if (searchMode === 'compare') {
      // Parse comma-separated lists
      const receptors = query.split(',').map((r: string) => r.trim()).filter(Boolean);
      const ligands = (secondQuery as string).split(',').map((l: string) => l.trim()).filter(Boolean);

      // Create combinations for current page
      const allPairs = [];
      for (const receptor of receptors) {
        for (const ligand of ligands) {
          allPairs.push({
            p1_id: receptor,
            p1_name: receptor,
            p2_id: ligand,
            p2_name: ligand
          });
        }
      }

      if (allPairs.length === 0) {
        return new Response(
          `data: ${JSON.stringify({ 
            error: "No valid gene pairs to analyze",
            details: "Please enter at least one receptor and one ligand."
          })}\n\n`,
          {
            headers: {
              'Content-Type': 'text/event-stream',
              'Cache-Control': 'no-cache',
              'Connection': 'keep-alive',
            },
          }
        );
      }

      // Calculate pagination
      const startIdx = (page - 1) * MAX_PAIRS_PER_REQUEST;
      pairs = allPairs.slice(startIdx, startIdx + MAX_PAIRS_PER_REQUEST);
      
      if (pairs.length === 0) {
        return new Response(
          `data: ${JSON.stringify({ 
            error: "No more pairs to analyze",
            details: "All specified gene pairs have been processed."
          })}\n\n`,
          {
            headers: {
              'Content-Type': 'text/event-stream',
              'Cache-Control': 'no-cache',
              'Connection': 'keep-alive',
            },
          }
        );
      }

    } else {
      // Search all mode - check if the input gene exists
      const searchField = queryType === 'receptor' ? 'p1' : 'p2';
      const otherField = queryType === 'receptor' ? 'p2' : 'p1';
      
      // Check if the gene exists in the database
      const geneQuery = {
        $or: [
          { [`${searchField}_id`]: query },
          { [`${searchField}_name`]: { $regex: new RegExp(query, 'i') } }
        ]
      };
      
      const geneExists = await pairsCollection.findOne(geneQuery);
      
      if (!geneExists) {
        const errorMessage = queryType === 'receptor'
          ? `No receptor found with gene name or UniProt ID "${query}"`
          : `No ligand found with gene name or UniProt ID "${query}"`;
        return new Response(
          `data: ${JSON.stringify({ 
            error: errorMessage,
            details: `The ${queryType} "${query}" was not found in our database. Please check the gene name or UniProt ID and try again.`
          })}\n\n`,
          {
            headers: {
              'Content-Type': 'text/event-stream',
              'Cache-Control': 'no-cache',
              'Connection': 'keep-alive',
            },
          }
        );
      }

      // Get all matching pairs
      pairs = await pairsCollection
        .find(geneQuery)
        .skip((page - 1) * MAX_PAIRS_PER_REQUEST)
        .limit(MAX_PAIRS_PER_REQUEST)
        .toArray();

      if (!pairs.length && page === 1) {
        const errorMessage = queryType === 'receptor'
          ? `No ligand pairs found for receptor "${query}"`
          : `No receptor pairs found for ligand "${query}"`;
        return new Response(
          `data: ${JSON.stringify({ 
            error: errorMessage,
            details: `No interaction pairs were found for the ${queryType} "${query}" in our database.`
          })}\n\n`,
          {
            headers: {
              'Content-Type': 'text/event-stream',
              'Cache-Control': 'no-cache',
              'Connection': 'keep-alive',
            },
          }
        );
      }
    }

    if (!pairs.length) {
      return NextResponse.json({ 
        results: [], 
        hasMore: false,
        message: 'No more results' 
      });
    }

    const encoder = new TextEncoder();
    const stream = new TransformStream();
    const writer = stream.writable.getWriter();

    // Process pairs and send updates
    (async () => {
      try {
        const results: SearchResult[] = [];
        const errors: string[] = [];
        
        for (const pair of pairs) {
          try {
            // Send update for receptor processing
            const receptorId = queryType === 'receptor' ? pair.p1_id : pair.p2_id;
            await writer.write(
              encoder.encode(`data: ${JSON.stringify({ currentGene: receptorId })}\n\n`)
            );

            const receptorExpr = await dataExtractor.get_expression_matrix(receptorId);
            if (!receptorExpr) {
              const errorMsg = searchMode === 'compare' 
                ? `Could not fetch expression data for receptor "${receptorId}". Please verify this gene name or UniProt ID exists.`
                : `Could not fetch expression data for receptor ${receptorId}`;
              errors.push(errorMsg);
              continue;
            }
            
            // Send update for ligand processing
            const ligandId = queryType === 'receptor' ? pair.p2_id : pair.p1_id;
            await writer.write(
              encoder.encode(`data: ${JSON.stringify({ currentGene: ligandId })}\n\n`)
            );
            
            const ligandExpr = await dataExtractor.get_expression_matrix(ligandId);
            if (!ligandExpr) {
              const errorMsg = searchMode === 'compare'
                ? `Could not fetch expression data for ligand "${ligandId}". Please verify this gene name or UniProt ID exists.`
                : `Could not fetch expression data for ligand ${ligandId}`;
              errors.push(errorMsg);
              continue;
            }

            const features = dataExtractor.compute_coexpression_features(
              receptorExpr,
              ligandExpr
            );

            results.push({
              pair,
              features,
              expression: {
                receptor: queryType === 'receptor' ? receptorExpr : ligandExpr,
                ligand: queryType === 'receptor' ? ligandExpr : receptorExpr
              }
            });
          } catch (error) {
            const errorMessage = searchMode === 'compare'
              ? `Error processing pair "${pair.p1_id}-${pair.p2_id}": ${error instanceof Error ? error.message : 'Unknown error'}`
              : `Error processing pair ${pair.p1_id}-${pair.p2_id}: ${error instanceof Error ? error.message : 'Unknown error'}`;
            console.error(errorMessage);
            errors.push(errorMessage);
            continue;
          }
        }

        // Sort by Pearson correlation
        results.sort((a, b) => b.features.combined.pearson_corr - a.features.combined.pearson_corr);

        // If in compare mode and no results but we have errors, send a more specific error
        if (searchMode === 'compare' && results.length === 0 && errors.length > 0) {
          await writer.write(
            encoder.encode(`data: ${JSON.stringify({ 
              error: "No valid expression data found for any gene pairs",
              details: "None of the specified gene pairs could be analyzed. Please check the gene names or UniProt IDs.",
              errors: errors
            })}\n\n`)
          );
          return;
        }

        // Send final results with pagination info and any errors
        await writer.write(
          encoder.encode(`data: ${JSON.stringify({ 
            results,
            hasMore: pairs.length === MAX_PAIRS_PER_REQUEST,
            currentPage: page,
            errors: errors.length > 0 ? errors : undefined
          })}\n\n`)
        );
      } catch (error) {
        console.error('Processing error:', error);
        await writer.write(
          encoder.encode(`data: ${JSON.stringify({ 
            error: 'Error processing results',
            details: error instanceof Error ? error.message : 'Unknown error'
          })}\n\n`)
        );
      } finally {
        await writer.close();
      }
    })();

    return new Response(stream.readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
    
  } catch (error) {
    console.error('Search error:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 