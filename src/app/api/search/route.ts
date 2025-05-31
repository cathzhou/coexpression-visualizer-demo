import { NextResponse } from 'next/server';
import clientPromise from '@/utils/mongodb';
import { ExpressionDataExtractor } from '@/utils/expressionDataExtractor';
import type { ExpressionProfile, ReceptorLigandPair, SearchResult } from '@/types';

const dataExtractor = new ExpressionDataExtractor();

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

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('query');
    const secondQuery = searchParams.get('secondQuery');
    const queryType = searchParams.get('queryType') as 'receptor' | 'ligand';
    const searchMode = searchParams.get('searchMode') as 'all' | 'compare';
    
    if (!query || (!searchMode) || (searchMode === 'compare' && !secondQuery)) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('coexpression_db');
    const pairsCollection = db.collection<ReceptorLigandPair>('receptor_ligand_pairs');
    
    let pairs: ReceptorLigandPair[] = [];

    if (searchMode === 'compare') {
      // Parse comma-separated lists
      const receptors = query.split(',').map((r: string) => r.trim()).filter(Boolean);
      const ligands = (secondQuery as string).split(',').map((l: string) => l.trim()).filter(Boolean);

      // Create all possible combinations
      for (const receptor of receptors) {
        for (const ligand of ligands) {
          pairs.push({
            p1_id: receptor,
            p1_name: receptor,
            p2_id: ligand,
            p2_name: ligand
          });
        }
      }
    } else {
      // Search all mode - search in MongoDB
      const searchQuery = {
        $or: queryType === 'receptor' 
          ? [{ p1_id: query }, { p1_name: { $regex: new RegExp(query, 'i') } }]
          : [{ p2_id: query }, { p2_name: { $regex: new RegExp(query, 'i') } }]
      };

      pairs = await pairsCollection.find(searchQuery).toArray();
    }

    if (!pairs.length) {
      return NextResponse.json({ error: 'No matching pairs found' }, { status: 404 });
    }

    const encoder = new TextEncoder();
    const stream = new TransformStream();
    const writer = stream.writable.getWriter();

    // Process pairs and send updates
    (async () => {
      try {
        const results: SearchResult[] = [];
        
        for (const pair of pairs) {
          try {
            // Send update for receptor processing
            await writer.write(
              encoder.encode(`data: ${JSON.stringify({ currentGene: pair.p1_id })}\n\n`)
            );

            const receptorExpr = await dataExtractor.get_expression_matrix(pair.p1_id);
            
            // Send update for ligand processing
            await writer.write(
              encoder.encode(`data: ${JSON.stringify({ currentGene: pair.p2_id })}\n\n`)
            );
            
            const ligandExpr = await dataExtractor.get_expression_matrix(pair.p2_id);
            
            if (!receptorExpr || !ligandExpr) continue;

            const features = dataExtractor.compute_coexpression_features(
              receptorExpr,
              ligandExpr
            );

            if (!features) continue;

            results.push({
              pair,
              features,
              plots: {
                receptor: `/data/expression_cache/plots/${pair.p1_id}_expression.png`,
                ligand: `/data/expression_cache/plots/${pair.p2_id}_expression.png`
              }
            });
          } catch (error) {
            console.error(`Error processing pair ${pair.p1_id}-${pair.p2_id}:`, error);
            continue;
          }
        }

        // Sort by Pearson correlation
        results.sort((a, b) => b.features.pearson_corr - a.features.pearson_corr);

        // Send final results
        await writer.write(
          encoder.encode(`data: ${JSON.stringify({ results })}\n\n`)
        );
      } catch (error) {
        console.error('Processing error:', error);
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
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 