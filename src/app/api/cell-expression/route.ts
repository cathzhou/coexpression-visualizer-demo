import { NextResponse } from 'next/server';
import clientPromise from '@/utils/mongodb';

interface ExpressionRecord {
  g: string;         // gene
  gn: string;        // gene_name
  t: string;         // tissue
  c: string;         // cluster
  ct: string;        // cell_type
  n: number;         // nTPM
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const gene1 = searchParams.get('gene1');
    const gene2 = searchParams.get('gene2');
    const cellType = searchParams.get('cellType');

    if (!gene1 || !gene2 || !cellType) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('coexpression_db');
    const collection = db.collection<ExpressionRecord>('expression_data');

    // Query for both genes in the specified cell type
    // Build query - optimized for performance
    const geneNames = [gene1.toUpperCase(), gene2.toUpperCase(), gene1.toLowerCase(), gene2.toLowerCase()];
    const query = {
      ct: cellType,
      $or: [
        { gn: { $in: geneNames } },
        { g: { $in: geneNames } }
      ]
    };

    const expressionData = await collection.find(query).toArray();

    // Separate data by gene
    const gene1Data = expressionData.filter(record =>
      record.gn.toLowerCase() === gene1.toLowerCase() ||
      record.g.toLowerCase() === gene1.toLowerCase()
    );

    const gene2Data = expressionData.filter(record =>
      record.gn.toLowerCase() === gene2.toLowerCase() ||
      record.g.toLowerCase() === gene2.toLowerCase()
    );

    // Create tissue mapping with expression values
    const tissueExpression: any[] = [];
    const uniqueTissues = [...new Set(expressionData.map(record => record.t))];

    for (const tissue of uniqueTissues) {
      const gene1Tissue = gene1Data.find(record => record.t === tissue);
      const gene2Tissue = gene2Data.find(record => record.t === tissue);

      tissueExpression.push({
        tissueType: tissue.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        tissue: tissue,
        gene1_name: gene1Data[0]?.gn || gene1,
        gene1_expression: gene1Tissue?.n || 0,
        gene2_name: gene2Data[0]?.gn || gene2,
        gene2_expression: gene2Tissue?.n || 0,
        cluster: gene1Tissue?.c || gene2Tissue?.c || '',
        cell_type: gene1Tissue?.ct || gene2Tissue?.ct || ''
      });
    }

    // Sort by tissue name
    tissueExpression.sort((a, b) => a.tissue.localeCompare(b.tissue));

    return NextResponse.json(tissueExpression);

  } catch (error) {
    console.error('Error fetching cell expression data:', error);
    return NextResponse.json({
      error: 'Failed to fetch cell expression data',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}