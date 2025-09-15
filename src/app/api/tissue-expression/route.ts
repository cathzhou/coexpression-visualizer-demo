import { NextResponse } from 'next/server';
import clientPromise from '@/utils/mongodb';

interface ExpressionRecord {
  gene: string;
  gene_name: string;
  tissue: string;
  cluster: string;
  cell_type: string;
  read_count: number;
  nTPM: number;
  cell_type_full: string;
  tissue_cell_combo: string;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const gene1 = searchParams.get('gene1');
    const gene2 = searchParams.get('gene2');
    const tissue = searchParams.get('tissue');

    if (!gene1 || !gene2 || !tissue) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('coexpression_db');
    const collection = db.collection<ExpressionRecord>('expression_data');

    // Query for both genes in the specified tissue
    const query = {
      tissue: tissue,
      $or: [
        { gene_name: { $in: [gene1, gene2] } },
        { gene: { $in: [gene1, gene2] } },
        { gene_name: { $regex: new RegExp(`^${gene1}$`, 'i') } },
        { gene_name: { $regex: new RegExp(`^${gene2}$`, 'i') } },
        { gene: { $regex: new RegExp(`^${gene1}$`, 'i') } },
        { gene: { $regex: new RegExp(`^${gene2}$`, 'i') } }
      ]
    };

    const expressionData = await collection.find(query).toArray();

    // Separate data by gene
    const gene1Data = expressionData.filter(record =>
      record.gene_name.toLowerCase() === gene1.toLowerCase() ||
      record.gene.toLowerCase() === gene1.toLowerCase()
    );

    const gene2Data = expressionData.filter(record =>
      record.gene_name.toLowerCase() === gene2.toLowerCase() ||
      record.gene.toLowerCase() === gene2.toLowerCase()
    );

    // Create cell type mapping with expression values
    const cellTypeExpression: any[] = [];
    const uniqueCellTypes = [...new Set(expressionData.map(record => record.cell_type_full))];

    for (const cellType of uniqueCellTypes) {
      const gene1Cell = gene1Data.find(record => record.cell_type_full === cellType);
      const gene2Cell = gene2Data.find(record => record.cell_type_full === cellType);

      cellTypeExpression.push({
        cellType: cellType,
        gene1_name: gene1Data[0]?.gene_name || gene1,
        gene1_expression: gene1Cell?.nTPM || 0,
        gene2_name: gene2Data[0]?.gene_name || gene2,
        gene2_expression: gene2Cell?.nTPM || 0,
        cluster: gene1Cell?.cluster || gene2Cell?.cluster || '',
        cell_type: gene1Cell?.cell_type || gene2Cell?.cell_type || ''
      });
    }

    // Sort by cell type name
    cellTypeExpression.sort((a, b) => a.cellType.localeCompare(b.cellType));

    return NextResponse.json({
      tissue,
      gene1,
      gene2,
      expressionData: cellTypeExpression
    });

  } catch (error) {
    console.error('Error fetching tissue expression data:', error);
    return NextResponse.json({
      error: 'Failed to fetch tissue expression data',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}